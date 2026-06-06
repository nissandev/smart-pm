import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from './task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UserRole, UserDocument } from '../users/user.schema';
import { ProjectsService } from '../projects/projects.service';
import { getProjectLeadId } from '../projects/project-lead.util';
import { ActivityService } from '../activity/activity.service';
import { ActionType } from '../activity/activity.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.schema';
import { UsersService } from '../users/users.service';

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

  async findAll(user: UserDocument, filters?: any): Promise<TaskDocument[]> {
    const query: any = {};

    if (user.role === UserRole.MEMBER) {
      query.assignedTo = user._id;
    } else if (user.role === UserRole.PROJECT_MANAGER) {
      const ownedProjects = await this.projectsService.findAll(user);
      const pmScope = {
        $or: [
          { project: { $in: ownedProjects.map((p: any) => p._id) } },
          { assignedTo: user._id },
        ],
      };
      if (filters?.project) {
        query.$and = [pmScope, { project: filters.project }];
      } else {
        Object.assign(query, pmScope);
      }
    }

    if (filters?.project && user.role !== UserRole.PROJECT_MANAGER) {
      query.project = filters.project;
    }
    if (filters?.status) query.status = filters.status;
    if (filters?.priority) query.priority = filters.priority;
    if (filters?.assignedTo) query.assignedTo = filters.assignedTo;
    // PRD §09: "Created by" filter (admin-only view)
    if (filters?.createdBy && user.role === UserRole.ADMIN) {
      query.createdBy = filters.createdBy;
    }

    return this.taskModel
      .find(query)
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
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<TaskDocument> {
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

  async update(id: string, dto: UpdateTaskDto, user: UserDocument): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id).populate('project');
    if (!task) throw new NotFoundException('Task not found');

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
    const task = await this.taskModel.findById(id).populate('project');
    if (!task) throw new NotFoundException('Task not found');
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

    await task.deleteOne();
  }

  // ── Attachments (PRD §10) ─────────────────────────────────────────
  async addAttachment(
    taskId: string,
    file: { url: string; name: string; size?: number; mimeType?: string },
    user: UserDocument,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId).populate('project');
    if (!task) throw new NotFoundException('Task not found');

    const projectDoc = task.project as any;
    // Allow if admin, or PM/member of the project
    const userId = (user as any)._id.toString();
    const isMember =
      user.role === UserRole.ADMIN ||
      projectDoc?.members?.some(
        (m: any) => m._id?.toString() === userId || m.toString() === userId,
      );
    if (!isMember) throw new ForbiddenException('Not a project member');

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
    const task = await this.taskModel.findById(taskId).populate('project');
    if (!task) throw new NotFoundException('Task not found');
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
    task.attachments.splice(index, 1);
    return task.save();
  }

  async addComment(taskId: string, text: string, user: UserDocument): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId).populate('project');
    if (!task) throw new NotFoundException('Task not found');
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
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');
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
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');
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

  async getStats(user: UserDocument) {
    const tasks = await this.findAll(user);
    const now = new Date();
    return {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === TaskStatus.TODO).length,
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      overdue: tasks.filter(
        (t) => t.status !== TaskStatus.COMPLETED && new Date(t.dueDate) < now,
      ).length,
    };
  }
}
