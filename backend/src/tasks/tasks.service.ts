import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus, TaskPriority } from './task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { parseCsv, TASK_CSV_HEADERS, rowToCsv } from './task-csv.util';
import { UserRole, UserDocument } from '../users/user.schema';
import { ProjectsService } from '../projects/projects.service';
import { getProjectLeadId } from '../projects/project-lead.util';
import { ActivityService } from '../activity/activity.service';
import { ActionType } from '../activity/activity.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.schema';
import { UsersService } from '../users/users.service';
import { buildTaskScopeFilter } from '../common/project-scope.util';
import {
  parsePagination,
  toPaginatedResult,
  type PaginatedResult,
} from '../common/pagination.util';
import { collectAttachmentUrls, deleteUploadByUrl } from '../common/file-cleanup.util';
import { resolveSecureUploadPath } from '../common/upload-path.util';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private projectsService: ProjectsService,
    private activityService: ActivityService,
    private notifications: NotificationsService,
    private usersService: UsersService,
  ) {}

  async create(dto: CreateTaskDto, user: UserDocument): Promise<TaskDocument> {
    const dueDate = new Date(dto.dueDate);
    // PRD §05: "Due date must be today or a future date"
    // Compare at day-precision so a task whose dueDate is today (any tz) is accepted.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      throw new BadRequestException('Please select a valid deadline');
    }

    const project = await this.projectsService.findById(dto.project, user);

    // PRD §02 + §04: PM can create tasks only within their own projects.
    // Member already blocked at the @Roles guard layer; re-check here for defence-in-depth.
    if (user.role === UserRole.PROJECT_MANAGER) {
      const userId = (user as any)._id.toString();
      const projectLeadId = getProjectLeadId(project as any);
      if (projectLeadId !== userId) {
        throw new ForbiddenException('You can only create tasks in projects you lead');
      }
    }
    if (user.role === UserRole.MEMBER) {
      throw new ForbiddenException('Members cannot create tasks');
    }

    const titleRegex = new RegExp(`^${dto.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const existing = await this.taskModel.findOne({ project: dto.project, title: titleRegex });
    if (existing) throw new ConflictException('This task already exists in the project');

    if (dto.assignedTo) {
      await this.ensureAssigneeProjectAccess(dto.project, dto.assignedTo, user, project);
    }

    const task = new this.taskModel({ ...dto, createdBy: user._id });
    const saved = await (await task.save()).populate(['assignedTo', 'createdBy']);

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.TASK_CREATED,
      entityType: 'task',
      entityId: saved._id,
      description: `Task "${saved.title}" was created`,
      project: new Types.ObjectId(dto.project),
    });

    if (dto.assignedTo) {
      await this.activityService.log({
        actor: (user as any)._id,
        actionType: ActionType.TASK_ASSIGNED,
        entityType: 'task',
        entityId: saved._id,
        description: `Task "${saved.title}" was assigned`,
        project: new Types.ObjectId(dto.project),
      });
      await this.notifications.create({
        recipient: dto.assignedTo,
        actor: (user as any)._id,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New task assigned to you',
        message: `"${saved.title}"`,
        task: saved._id,
        project: new Types.ObjectId(dto.project),
      });
    }

    return saved;
  }

  async findAll(
    user: UserDocument,
    filters?: Record<string, string | undefined>,
    page?: string,
    limit?: string,
  ): Promise<PaginatedResult<TaskDocument>> {
    const projectIds = await this.projectsService.findAccessibleProjectIds(user);
    const conditions: Record<string, unknown>[] = [buildTaskScopeFilter(user, projectIds)];

    if (filters?.project) conditions.push({ project: filters.project });
    if (filters?.status) conditions.push({ status: filters.status });
    if (filters?.priority) conditions.push({ priority: filters.priority });
    if (filters?.assignedTo) conditions.push({ assignedTo: filters.assignedTo });
    if (filters?.createdBy && user.role === UserRole.ADMIN) {
      conditions.push({ createdBy: filters.createdBy });
    }

    // Full-text search across title and description
    if (filters?.search?.trim()) {
      const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      conditions.push({ $or: [{ title: regex }, { description: regex }] });
    }

    // Deadline filter
    if (filters?.deadline) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (filters.deadline === 'overdue') {
        conditions.push({ dueDate: { $lt: now }, status: { $ne: TaskStatus.COMPLETED } });
      } else if (filters.deadline === 'upcoming') {
        const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        conditions.push({ dueDate: { $gte: now, $lte: in7 }, status: { $ne: TaskStatus.COMPLETED } });
      }
    }

    const query = conditions.length === 1 ? conditions[0] : { $and: conditions };

    // Sort mapping
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest:   { createdAt: -1 },
      deadline: { dueDate: 1 },
      priority: { priority: 1 },
      updated:  { updatedAt: -1 },
    };
    const sortOrder = sortMap[filters?.sort ?? ''] ?? { createdAt: -1 };

    const pagination = parsePagination(page, limit);
    const [data, total] = await Promise.all([
      this.taskModel
        .find(query)
        .populate('project', 'name leadId members createdBy')
        .populate('assignedTo', 'name email avatar')
        .populate('createdBy', 'name email')
        .sort(sortOrder)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .exec(),
      this.taskModel.countDocuments(query).exec(),
    ]);
    return toPaginatedResult(data, total, pagination);
  }

  async findById(id: string, user: UserDocument): Promise<TaskDocument> {
    await this.assertScopedTaskAccess(id, user);

    const task = await this.taskModel
      .findById(id)
      .populate({
        path: 'project',
        select: 'name createdBy leadId members',
        populate: [
          { path: 'createdBy', select: 'name email role' },
          { path: 'leadId', select: 'name email role' },
          { path: 'members', select: 'name email role' },
        ],
      })
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email')
      .populate('comments.author', 'name email avatar');
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  /** Stream attachment bytes after verifying task access. */
  async getAttachmentForDownload(
    taskId: string,
    index: number,
    user: UserDocument,
  ): Promise<{ absolutePath: string; name: string; mimeType?: string }> {
    await this.assertScopedTaskAccess(taskId, user);
    const task = await this.taskModel.findById(taskId).select('attachments').lean();
    if (!task) throw new NotFoundException('Task not found');
    if (index < 0 || index >= (task.attachments?.length ?? 0)) {
      throw new NotFoundException('Attachment not found');
    }
    const att = task.attachments[index] as { url?: string; name?: string; mimeType?: string };
    const absolutePath = resolveSecureUploadPath(att.url);
    if (!absolutePath) {
      throw new NotFoundException('Attachment not found');
    }
    return { absolutePath, name: att.name ?? 'download', mimeType: att.mimeType };
  }

  async update(id: string, dto: UpdateTaskDto, user: UserDocument): Promise<TaskDocument> {
    const task = await this.findScopedTaskWithProject(id, user);

    const userId = (user as any)._id.toString();

    if (user.role === UserRole.MEMBER) {
      const assignedId = task.assignedTo?.toString();
      if (assignedId !== userId) throw new ForbiddenException('You can only update your own tasks');
      if (Object.keys(dto).some((k) => k !== 'status')) {
        throw new ForbiddenException('Members can only update task status');
      }
    } else if (user.role === UserRole.PROJECT_MANAGER) {
      this.assertPmCanEditTask(task, userId, dto);
    }

    if (dto.assignedTo && task.status === TaskStatus.COMPLETED) {
      throw new BadRequestException('Completed tasks cannot be reassigned');
    }

    if (dto.assignedTo) {
      const projectId = ((task.project as any)?._id ?? task.project).toString();
      await this.ensureAssigneeProjectAccess(projectId, dto.assignedTo, user, task.project as any);
    }

    if (dto.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(dto.dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < today) throw new BadRequestException('Please select a valid deadline');
    }

    if (dto.title && dto.title.trim().toLowerCase() !== task.title.toLowerCase()) {
      const titleRegex = new RegExp(`^${dto.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const existing = await this.taskModel.findOne({ project: task.project, title: titleRegex });
      if (existing) throw new ConflictException('This task already exists in the project');
    }

    const prevStatus = task.status;
    const prevAssigneeId = task.assignedTo?.toString();
    const updated = await this.taskModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email');

    if (!updated) throw new NotFoundException('Task not found after update');

    const projectId = (task.project as any)?._id ?? task.project;

    if (dto.status && dto.status !== prevStatus) {
      await this.activityService.log({
        actor: (user as any)._id,
        actionType: ActionType.STATUS_CHANGED,
        entityType: 'task',
        entityId: task._id,
        description: `Task "${task.title}" status changed to "${dto.status}"`,
        project: projectId,
      });
      // PRD §10 — notify project members (here: assignee + creator) when status changes
      const recipients = new Set<string>();
      if (updated?.assignedTo) recipients.add(updated.assignedTo._id?.toString() ?? updated.assignedTo.toString());
      if (task.createdBy) recipients.add(task.createdBy.toString());
      for (const rec of recipients) {
        await this.notifications.create({
          recipient: rec,
          actor: (user as any)._id,
          type: NotificationType.TASK_STATUS_CHANGED,
          title: `Task marked ${dto.status}`,
          message: `"${task.title}"`,
          task: task._id,
          project: projectId,
        });
      }
    } else if (dto.assignedTo) {
      await this.activityService.log({
        actor: (user as any)._id,
        actionType: ActionType.TASK_ASSIGNED,
        entityType: 'task',
        entityId: task._id,
        description: `Task "${task.title}" was reassigned`,
        project: projectId,
      });
      // Notify the new assignee if they actually changed
      if (dto.assignedTo !== prevAssigneeId) {
        await this.notifications.create({
          recipient: dto.assignedTo,
          actor: (user as any)._id,
          type: NotificationType.TASK_ASSIGNED,
          title: 'Task assigned to you',
          message: `"${task.title}"`,
          task: task._id,
          project: projectId,
        });
      }
    } else {
      await this.activityService.log({
        actor: (user as any)._id,
        actionType: ActionType.TASK_UPDATED,
        entityType: 'task',
        entityId: task._id,
        description: `Task "${task.title}" was updated`,
        project: projectId,
      });
    }

    return updated;
  }

  async remove(id: string, user: UserDocument): Promise<void> {
    const task = await this.findScopedTaskWithProject(id, user);
    const userId = (user as any)._id.toString();
    if (user.role === UserRole.MEMBER) {
      throw new ForbiddenException('Members cannot delete tasks');
    }
    // PRD §02: PM can delete tasks only in their own projects.
    if (user.role === UserRole.PROJECT_MANAGER) {
      const projectLeadId = getProjectLeadId((task.project as any) ?? {});
      if (projectLeadId !== userId) {
        throw new ForbiddenException('You can only delete tasks in projects you lead');
      }
    }

    const projectId = (task.project as any)?._id ?? task.project;

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.TASK_DELETED,
      entityType: 'task',
      entityId: task._id,
      description: `Task "${task.title}" was deleted`,
      project: projectId,
    });

    const fileUrls = collectAttachmentUrls(task.attachments);
    await task.deleteOne();
    for (const url of fileUrls) {
      deleteUploadByUrl(url);
    }
  }

  // ── Attachments (PRD §10) ─────────────────────────────────────────
  async addAttachment(
    taskId: string,
    file: { url: string; name: string; size?: number; mimeType?: string },
    user: UserDocument,
  ): Promise<TaskDocument> {
    const task = await this.findScopedTaskWithProject(taskId, user);
    this.assertProjectMember(task, user);

    task.attachments.push({
      url: file.url,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      uploadedBy: (user as any)._id,
      uploadedAt: new Date(),
    } as any);
    return task.save();
  }

  async removeAttachment(taskId: string, index: number, user: UserDocument): Promise<TaskDocument> {
    const task = await this.findScopedTaskWithProject(taskId, user);
    if (index < 0 || index >= task.attachments.length) {
      throw new NotFoundException('Attachment not found');
    }
    const att: any = task.attachments[index];
    const userId = (user as any)._id.toString();
    const isOwner = att.uploadedBy?.toString() === userId;
    const isAdmin = user.role === UserRole.ADMIN;
    const projectLeadId = getProjectLeadId((task.project as any) ?? {});
    const isProjectLead = user.role === UserRole.PROJECT_MANAGER && projectLeadId === userId;
    if (!isOwner && !isAdmin && !isProjectLead) {
      throw new ForbiddenException('You can only remove your own attachments');
    }
    deleteUploadByUrl(att.url);
    task.attachments.splice(index, 1);
    return task.save();
  }

  async addComment(taskId: string, text: string, user: UserDocument): Promise<TaskDocument> {
    const task = await this.findScopedTaskWithProject(taskId, user);
    // PRD §10: only project members (or admin) can comment
    this.assertProjectMember(task, user);
    task.comments.push({ author: (user as any)._id, text, createdAt: new Date() });
    const saved = await task.save();

    // Notify assignee & creator (excluding the commenter — service handles self-skip)
    const recipients = new Set<string>();
    if (task.assignedTo) recipients.add(task.assignedTo.toString());
    if (task.createdBy) recipients.add(task.createdBy.toString());
    const projectId = (task.project as any)?._id ?? task.project;
    for (const rec of recipients) {
      await this.notifications.create({
        recipient: rec,
        actor: (user as any)._id,
        type: NotificationType.COMMENT_ADDED,
        title: `${user.name} commented`,
        message: `On "${task.title}"`,
        task: task._id,
        project: projectId,
      });
    }
    return saved;
  }

  async updateComment(taskId: string, commentId: string, text: string, user: UserDocument): Promise<TaskDocument> {
    const task = await this.findScopedTaskWithProject(taskId, user);
    this.assertProjectMember(task, user);
    const comment = (task.comments as any[]).find((c) => c._id.toString() === commentId);
    if (!comment) throw new NotFoundException('Comment not found');
    // PRD §10: only the author can edit a comment (admin can NOT edit others' comments)
    if (comment.author.toString() !== (user as any)._id.toString()) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    comment.text = text;
    return task.save();
  }

  async deleteComment(taskId: string, commentId: string, user: UserDocument): Promise<TaskDocument> {
    const task = await this.findScopedTaskWithProject(taskId, user);
    this.assertProjectMember(task, user);
    const comment = (task.comments as any[]).find((c) => c._id.toString() === commentId);
    if (!comment) throw new NotFoundException('Comment not found');
    const userId = (user as any)._id.toString();
    // PRD §10: author can delete own comments; admin can delete any comment
    if (comment.author.toString() !== userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    task.comments = (task.comments as any[]).filter((c) => c._id.toString() !== commentId) as any;
    return task.save();
  }

  /**
   * Task assignment grants responsibility, not ownership.
   * When an admin assigns to a non-member, add them to the project only.
   */
  private async ensureAssigneeProjectAccess(
    projectId: string,
    assigneeId: string,
    actor: UserDocument,
    project?: any,
  ) {
    const assignee = await this.usersService.findById(assigneeId);
    if (assignee.role === UserRole.ADMIN) {
      throw new BadRequestException('Tasks cannot be assigned to admin users');
    }

    const proj =
      project?.members != null
        ? project
        : await this.projectsService.findById(projectId, actor);

    const isMember = proj.members?.some(
      (m: any) => m._id?.toString() === assigneeId || m.toString() === assigneeId,
    );
    if (isMember) return;

    if (actor.role === UserRole.ADMIN) {
      await this.projectsService.ensureProjectMember(projectId, assigneeId, actor);
      return;
    }

    throw new BadRequestException('User is not a member of this project');
  }

  /** PM owners get full edit; assignee-only PMs may update status or reassign to members. */
  private assertPmCanEditTask(task: TaskDocument, userId: string, dto: UpdateTaskDto) {
    const projectLeadId = getProjectLeadId((task.project as any) ?? {});
    const assignedId = task.assignedTo?.toString();
    const isProjectLead = projectLeadId === userId;
    const isAssignee = assignedId === userId;

    if (isProjectLead) return;

    if (isAssignee) {
      const allowed = new Set(['status', 'assignedTo']);
      const fields = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined);
      if (fields.some((k) => !allowed.has(k))) {
        throw new ForbiddenException(
          'You can only update status or reassign tasks assigned to you. Project ownership is unchanged.',
        );
      }
      return;
    }

    throw new ForbiddenException('You can only manage tasks in your own projects or tasks assigned to you');
  }

  // Shared helper: PRD §10 requires project membership for commenting and attaching.
  private assertProjectMember(task: TaskDocument, user: UserDocument) {
    if (user.role === UserRole.ADMIN) return;
    const userId = (user as any)._id.toString();
    const project = task.project as any;
    const isMember = project?.members?.some(
      (m: any) => m._id?.toString() === userId || m.toString() === userId,
    );
    const isLead = getProjectLeadId(project ?? {}) === userId;
    if (!isMember && !isLead) {
      throw new ForbiddenException('Only project members can perform this action');
    }
  }

  /** Returns 404 when task is missing or outside the user's scope (no ID enumeration). */
  private async assertScopedTaskAccess(taskId: string, user: UserDocument): Promise<void> {
    const projectIds = await this.projectsService.findAccessibleProjectIds(user);
    const scope = buildTaskScopeFilter(user, projectIds);
    const exists = await this.taskModel.exists({ $and: [{ _id: taskId }, scope] });
    if (!exists) throw new NotFoundException('Task not found');
  }

  private async findScopedTaskWithProject(taskId: string, user: UserDocument): Promise<TaskDocument> {
    const projectIds = await this.projectsService.findAccessibleProjectIds(user);
    const scope = buildTaskScopeFilter(user, projectIds);
    const task = await this.taskModel
      .findOne({ $and: [{ _id: taskId }, scope] })
      .populate({
        path: 'project',
        select: 'name createdBy leadId members',
        populate: [
          { path: 'createdBy', select: 'name email role' },
          { path: 'leadId', select: 'name email role' },
          { path: 'members', select: 'name email role' },
        ],
      });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async getStats(user: UserDocument) {
    const projectIds = await this.projectsService.findAccessibleProjectIds(user);
    const taskFilter = buildTaskScopeFilter(user, projectIds);
    const now = new Date();

    const [statusRows, overdue] = await Promise.all([
      this.taskModel.aggregate([
        { $match: taskFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.taskModel
        .countDocuments({
          ...taskFilter,
          status: { $ne: TaskStatus.COMPLETED },
          dueDate: { $lt: now },
        })
        .exec(),
    ]);

    let total = 0;
    let todo = 0;
    let inProgress = 0;
    let completed = 0;
    for (const row of statusRows) {
      total += row.count;
      if (row._id === TaskStatus.TODO) todo = row.count;
      else if (row._id === TaskStatus.IN_PROGRESS) inProgress = row.count;
      else if (row._id === TaskStatus.COMPLETED) completed = row.count;
    }

    return { total, todo, inProgress, completed, overdue };
  }

  /** CSV template with example rows matching import format. */
  async buildImportTemplate(user: UserDocument): Promise<string> {
    const projects = await this.projectsService.findAccessibleProjectsMeta(user);
    const p1 = projects[0]?._id?.toString() ?? 'PASTE_PROJECT_ID_HERE';
    const p2 = projects[1]?._id?.toString() ?? p1;
    const due1 = this.formatDateForCsv(this.addDays(new Date(), 7));
    const due2 = this.formatDateForCsv(this.addDays(new Date(), 14));

    const lines = [
      TASK_CSV_HEADERS.join(','),
      rowToCsv([p1, 'Setup API', 'Configure REST endpoints', 'john@smartpm.dev', due1, 'High', 'Todo']),
      rowToCsv([p2, 'Homepage Design', 'Hero section mockups', 'jane@smartpm.dev', due2, 'Medium', 'In Progress']),
    ];
    return lines.join('\n') + '\n';
  }

  async bulkImportFromCsv(
    fileBuffer: Buffer,
    user: UserDocument,
  ): Promise<{
    created: number;
    failed: number;
    results: { row: number; title: string; success: boolean; error?: string }[];
  }> {
    if (user.role === UserRole.MEMBER) {
      throw new ForbiddenException('Members cannot bulk-import tasks');
    }

    const text = fileBuffer.toString('utf-8').trim();
    if (!text) throw new BadRequestException('CSV file is empty');

    const rows = parseCsv(text);
    if (rows.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row');
    }

    const headerMap = this.mapCsvHeaders(rows[0]);
    if (headerMap.project == null || headerMap.title == null || headerMap.duedate == null) {
      throw new BadRequestException(
        'CSV must include columns: project, title, dueDate (download the template for the correct format)',
      );
    }

    const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()));
    if (dataRows.length === 0) {
      throw new BadRequestException('No task rows found in CSV');
    }
    if (dataRows.length > 200) {
      throw new BadRequestException('Maximum 200 tasks per import');
    }

    const accessibleProjects = await this.projectsService.findAccessibleProjectsMeta(user);
    const projectByName = new Map(
      accessibleProjects.map((p) => [p.name.trim().toLowerCase(), p]),
    );
    const projectById = new Map(accessibleProjects.map((p) => [p._id.toString(), p]));

    const emailSet = new Set<string>();
    for (const row of dataRows) {
      const idx = headerMap.assignedtoemail;
      if (idx != null) {
        const email = (row[idx] ?? '').trim().toLowerCase();
        if (email) emailSet.add(email);
      }
    }
    const usersByEmail = await this.usersService.findByEmails(Array.from(emailSet));

    const results: { row: number; title: string; success: boolean; error?: string }[] = [];
    let created = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2;
      const row = dataRows[i];
      const get = (key: string) => {
        const idx = headerMap[key];
        return idx != null ? (row[idx] ?? '').trim() : '';
      };

      const title = get('title');
      const projectRef = get('project');
      const dueDateRaw = get('duedate');

      if (!title || !projectRef || !dueDateRaw) {
        results.push({
          row: rowNum,
          title: title || '(missing title)',
          success: false,
          error: 'project, title, and dueDate are required',
        });
        continue;
      }

      const project =
        projectById.get(projectRef) ??
        projectByName.get(projectRef.toLowerCase());
      if (!project) {
        results.push({
          row: rowNum,
          title,
          success: false,
          error: `Project not found or not accessible: "${projectRef}"`,
        });
        continue;
      }

      const priorityRaw = get('priority');
      const statusRaw = get('status');
      if (priorityRaw && !this.normalizePriority(priorityRaw)) {
        results.push({
          row: rowNum,
          title,
          success: false,
          error: 'Invalid priority — use High, Medium, or Low',
        });
        continue;
      }
      if (statusRaw && !this.normalizeStatus(statusRaw)) {
        results.push({
          row: rowNum,
          title,
          success: false,
          error: 'Invalid status — use Todo, In Progress, or Completed',
        });
        continue;
      }
      const priority = this.normalizePriority(priorityRaw) ?? TaskPriority.MEDIUM;
      const status = this.normalizeStatus(statusRaw) ?? TaskStatus.TODO;
      const dueDate = this.normalizeDueDate(dueDateRaw);
      if (!dueDate) {
        results.push({
          row: rowNum,
          title,
          success: false,
          error: 'Please select a valid deadline (use YYYY-MM-DD, today or future)',
        });
        continue;
      }

      let assignedTo: string | undefined;
      const email = get('assignedtoemail');
      if (email) {
        const assignee = usersByEmail.get(email.toLowerCase());
        if (!assignee) {
          results.push({ row: rowNum, title, success: false, error: `Assignee not found: ${email}` });
          continue;
        }
        assignedTo = assignee._id.toString();
      }

      const dto: CreateTaskDto = {
        project: project._id.toString(),
        title,
        description: get('description') || undefined,
        assignedTo,
        dueDate,
        priority,
        status,
      };

      try {
        await this.create(dto, user);
        results.push({ row: rowNum, title, success: true });
        created++;
      } catch (err: any) {
        results.push({
          row: rowNum,
          title,
          success: false,
          error: err?.response?.message ?? err?.message ?? 'Import failed',
        });
      }
    }

    return { created, failed: results.length - created, results };
  }

  private mapCsvHeaders(headerRow: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    headerRow.forEach((h, i) => {
      const key = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      map[key] = i;
      if (key === 'assignedto') map.assignedtoemail = i;
    });
    return map;
  }

  private normalizePriority(value: string): TaskPriority | null {
    if (!value) return null;
    const v = value.trim();
    if (Object.values(TaskPriority).includes(v as TaskPriority)) return v as TaskPriority;
    return null;
  }

  private normalizeStatus(value: string): TaskStatus | null {
    if (!value) return null;
    const v = value.trim();
    if (Object.values(TaskStatus).includes(v as TaskStatus)) return v as TaskStatus;
    return null;
  }

  private normalizeDueDate(value: string): string | null {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    if (!iso) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(iso);
    due.setHours(0, 0, 0, 0);
    if (due < today) return null;
    return iso;
  }

  private formatDateForCsv(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private addDays(d: Date, days: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  }
}
