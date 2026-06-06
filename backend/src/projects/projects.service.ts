import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument, ProjectStatus } from './project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserRole, UserDocument } from '../users/user.schema';
import { ActivityService } from '../activity/activity.service';
import { ActionType } from '../activity/activity.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.schema';
import { Task, TaskDocument } from '../tasks/task.schema';
import { UsersService } from '../users/users.service';
import { GroupsService } from '../groups/groups.service';
import { isProjectLead } from './project-lead.util';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private activityService: ActivityService,
    private notifications: NotificationsService,
    private usersService: UsersService,
    private groupsService: GroupsService,
  ) {}

  async create(dto: CreateProjectDto, user: UserDocument): Promise<ProjectDocument> {
    const deadline = new Date(dto.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    // PRD §03: deadline must be a future date at creation
    if (deadline <= today) {
      throw new BadRequestException('Deadline must be a future date');
    }
    // PRD §03: project name must be unique per team (case-insensitive)
    await this.assertUniqueName(dto.name);

    let leadId = dto.leadId ?? dto.ownerId;
    let teamMemberIds: Types.ObjectId[] = [];
    let teamId: Types.ObjectId | undefined;

    if (dto.teamId) {
      const group =
        user.role === UserRole.ADMIN
          ? await this.groupsService.findByIdForProject(dto.teamId)
          : await this.groupsService.findById(dto.teamId, user);

      if (!leadId) {
        leadId = group.leadId.toString();
      }
      teamMemberIds = [...group.memberIds, group.leadId];
      teamId = group._id as Types.ObjectId;
    }

    const { createdBy, leadId: leadObjectId, members } = await this.resolveInitialSetup(leadId, user);
    const mergedMembers = this.mergeMemberIds(members, teamMemberIds);
    const { ownerId: _ownerId, leadId: _leadId, teamId: _teamId, ...projectFields } = dto;

    const project = new this.projectModel({
      ...projectFields,
      createdBy,
      ...(leadObjectId ? { leadId: leadObjectId } : {}),
      members: mergedMembers,
      ...(teamId ? { teamId } : {}),
    });
    const saved = await project.save();
    await saved.populate([
      { path: 'createdBy', select: 'name email role' },
      { path: 'leadId', select: 'name email role' },
      { path: 'members', select: 'name email role' },
      { path: 'teamId', select: 'name leadId', populate: { path: 'leadId', select: 'name email' } },
    ]);

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.PROJECT_CREATED,
      entityType: 'project',
      entityId: saved._id,
      description: leadObjectId
        ? `Project "${saved.name}" was created (lead: ${(saved.leadId as any)?.name ?? 'PM'})`
        : `Project "${saved.name}" was created`,
      project: saved._id,
    });

    if (leadObjectId) {
      await this.notifications.create({
        recipient: leadObjectId,
        actor: (user as any)._id,
        type: NotificationType.MEMBER_ADDED,
        title: 'You are the lead of a new project',
        message: `"${saved.name}"`,
        project: saved._id,
      });
    }

    return saved;
  }

  async findAll(user: UserDocument): Promise<ProjectDocument[]> {
    const query =
      user.role === UserRole.ADMIN
        ? {}
        : user.role === UserRole.PROJECT_MANAGER
          ? { $or: [{ leadId: user._id }, { createdBy: user._id }] }
          : { members: user._id };

    return this.projectModel
      .find(query)
      .populate('createdBy', 'name email role')
      .populate('leadId', 'name email role')
      .populate({ path: 'members', model: 'User', select: 'name email role' })
      .populate({ path: 'teamId', select: 'name' })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string, user: UserDocument): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findById(id)
      .populate('createdBy', 'name email role')
      .populate('leadId', 'name email role')
      .populate({ path: 'members', model: 'User', select: 'name email role avatar' })
      .populate({ path: 'teamId', select: 'name leadId', populate: { path: 'leadId', select: 'name email' } });

    if (!project) throw new NotFoundException('Project not found');
    this.checkAccess(project, user);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: UserDocument): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(id);
    if (!project) throw new NotFoundException('Project not found');
    this.checkLeadOrAdmin(project, user);

    if (dto.deadline) {
      const deadline = new Date(dto.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadline.setHours(0, 0, 0, 0);
      // PRD §03: on edit, deadline must still be a valid future date
      if (deadline <= today) {
        throw new BadRequestException('Deadline must be a future date');
      }
    }
    if (dto.name && dto.name.trim().toLowerCase() !== project.name.toLowerCase()) {
      await this.assertUniqueName(dto.name, project._id);
    }

    const updated = await this.projectModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('createdBy', 'name email role')
      .populate('leadId', 'name email role')
      .populate({ path: 'members', model: 'User', select: 'name email role' });

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.PROJECT_UPDATED,
      entityType: 'project',
      entityId: updated._id,
      description: `Project "${updated.name}" was updated`,
      project: updated._id,
    });

    return updated;
  }

  async remove(id: string, user: UserDocument): Promise<void> {
    const project = await this.projectModel.findById(id);
    if (!project) throw new NotFoundException('Project not found');
    this.checkLeadOrAdmin(project, user);

    // PRD §03: deleting a project cascades to all its tasks
    const deleted = await this.taskModel.deleteMany({ project: project._id });

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.PROJECT_DELETED,
      entityType: 'project',
      entityId: project._id,
      description: `Project "${project.name}" was deleted (and ${deleted.deletedCount} task${deleted.deletedCount === 1 ? '' : 's'})`,
    });

    await project.deleteOne();
  }

  async addMember(
    projectId: string,
    memberId: string,
    user: UserDocument,
    makeLead = false,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    this.checkLeadOrAdmin(project, user);

    const memberObjectId = new Types.ObjectId(memberId);
    if (project.members.some((m) => m.equals(memberObjectId))) {
      throw new BadRequestException('User is already a member');
    }

    const memberUser = await this.usersService.findById(memberId);
    if (!memberUser.isActive) {
      throw new BadRequestException('Cannot add an inactive user');
    }

    if (makeLead) {
      if (memberUser.role !== UserRole.PROJECT_MANAGER) {
        throw new BadRequestException('Only Project Managers can be made project lead');
      }
    }

    project.members.push(memberObjectId);

    if (makeLead) {
      project.leadId = memberObjectId;
    }

    const saved = await project.save();
    await saved.populate([
      { path: 'createdBy', select: 'name email role' },
      { path: 'leadId', select: 'name email role' },
      { path: 'members', select: 'name email role' },
      { path: 'teamId', select: 'name' },
    ]);

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.MEMBER_ADDED,
      entityType: 'member',
      entityId: memberObjectId,
      description: `${memberUser.name} was added to "${project.name}"`,
      project: project._id,
    });

    await this.notifications.create({
      recipient: memberObjectId,
      actor: (user as any)._id,
      type: NotificationType.MEMBER_ADDED,
      title: 'You were added to a project',
      message: `"${project.name}"`,
      project: project._id,
    });

    if (makeLead) {
      await this.activityService.log({
        actor: (user as any)._id,
        actionType: ActionType.PROJECT_LEAD_ASSIGNED,
        entityType: 'project',
        entityId: project._id,
        description: `${memberUser.name} is now the lead of "${project.name}"`,
        project: project._id,
      });

      await this.notifications.create({
        recipient: memberObjectId,
        actor: (user as any)._id,
        type: NotificationType.MEMBER_ADDED,
        title: 'You are now the lead of a project',
        message: `"${project.name}"`,
        project: project._id,
      });
    }

    return saved;
  }

  async addMembersFromGroup(
    projectId: string,
    teamId: string,
    user: UserDocument,
    makeLead = false,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    this.checkLeadOrAdmin(project, user);

    const group =
      user.role === UserRole.ADMIN
        ? await this.groupsService.findByIdForProject(teamId)
        : await this.groupsService.findById(teamId, user);

    const candidateIds = [
      group.leadId,
      ...group.memberIds,
    ].map((id) => id.toString());

    const uniqueCandidates = [...new Set(candidateIds)];
    const existing = new Set(project.members.map((m) => m.toString()));
    const toAdd = uniqueCandidates.filter((id) => !existing.has(id));

    if (toAdd.length === 0) {
      throw new BadRequestException('All group members are already on this project');
    }

    const groupLeadId = group.leadId.toString();
    if (makeLead) {
      const leadUser = await this.usersService.findById(groupLeadId);
      if (leadUser.role !== UserRole.PROJECT_MANAGER) {
        throw new BadRequestException('Group lead must be a Project Manager');
      }
    }

    for (const memberId of toAdd) {
      const memberUser = await this.usersService.findById(memberId);
      if (!memberUser.isActive) {
        throw new BadRequestException(`Cannot add inactive user: ${memberUser.email}`);
      }
      project.members.push(new Types.ObjectId(memberId));
    }

    project.teamId = group._id as Types.ObjectId;

    if (makeLead) {
      project.leadId = new Types.ObjectId(groupLeadId);
    }

    const saved = await project.save();
    await saved.populate([
      { path: 'createdBy', select: 'name email role' },
      { path: 'leadId', select: 'name email role' },
      { path: 'members', select: 'name email role' },
      { path: 'teamId', select: 'name leadId', populate: { path: 'leadId', select: 'name email' } },
    ]);

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.MEMBER_ADDED,
      entityType: 'project',
      entityId: project._id,
      description: `Group "${group.name}" was added to "${project.name}" (${toAdd.length} member${toAdd.length !== 1 ? 's' : ''})`,
      project: project._id,
    });

    for (const memberId of toAdd) {
      await this.notifications.create({
        recipient: new Types.ObjectId(memberId),
        actor: (user as any)._id,
        type: NotificationType.MEMBER_ADDED,
        title: 'You were added to a project',
        message: `"${project.name}"`,
        project: project._id,
      });
    }

    if (makeLead) {
      const leadUser = await this.usersService.findById(groupLeadId);
      await this.activityService.log({
        actor: (user as any)._id,
        actionType: ActionType.PROJECT_LEAD_ASSIGNED,
        entityType: 'project',
        entityId: project._id,
        description: `${leadUser.name} is now the lead of "${project.name}" (via group "${group.name}")`,
        project: project._id,
      });
      await this.notifications.create({
        recipient: new Types.ObjectId(groupLeadId),
        actor: (user as any)._id,
        type: NotificationType.MEMBER_ADDED,
        title: 'You are now the lead of a project',
        message: `"${project.name}"`,
        project: project._id,
      });
    }

    return saved;
  }

  /**
   * Adds a user to project.members when they are not already a member.
   * Does NOT change project ownership — used when an admin assigns a task
   * to someone who still needs project access.
   */
  async ensureProjectMember(
    projectId: string,
    memberId: string,
    actor: UserDocument,
  ): Promise<boolean> {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can auto-add members during task assignment');
    }

    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');

    const memberObjectId = new Types.ObjectId(memberId);
    if (project.members.some((m) => m.equals(memberObjectId))) {
      return false;
    }

    const memberUser = await this.usersService.findById(memberId);
    if (!memberUser.isActive) {
      throw new BadRequestException('Cannot add an inactive user to the project');
    }

    project.members.push(memberObjectId);
    await project.save();

    await this.activityService.log({
      actor: (actor as any)._id,
      actionType: ActionType.MEMBER_ADDED,
      entityType: 'member',
      entityId: memberObjectId,
      description: `${memberUser.name} was added to "${project.name}" (via task assignment)`,
      project: project._id,
    });

    await this.notifications.create({
      recipient: memberObjectId,
      actor: (actor as any)._id,
      type: NotificationType.MEMBER_ADDED,
      title: 'You were added to a project',
      message: `"${project.name}"`,
      project: project._id,
    });

    return true;
  }

  async removeMember(projectId: string, memberId: string, user: UserDocument): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    this.checkLeadOrAdmin(project, user);

    const actorId = (user as any)._id.toString();
    const targetId = memberId.toString();
    const ownerId = project.createdBy.toString();

    if (targetId === actorId) {
      throw new BadRequestException('You cannot remove yourself from the project');
    }

    if (targetId === ownerId) {
      throw new BadRequestException(
        'Cannot remove the project owner (admin). They always retain ownership of this project.',
      );
    }

    if (!project.members.some((m) => m.toString() === targetId)) {
      throw new BadRequestException('User is not a member of this project');
    }

    const removedUser = await this.usersService.findById(memberId);

    project.members = project.members.filter((m) => m.toString() !== targetId);
    if (project.leadId?.toString() === targetId) {
      project.leadId = undefined;
    }
    const saved = await project.save();
    await saved.populate([
      { path: 'createdBy', select: 'name email role' },
      { path: 'leadId', select: 'name email role' },
      { path: 'members', select: 'name email role' },
      { path: 'teamId', select: 'name' },
    ]);

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.MEMBER_REMOVED,
      entityType: 'member',
      entityId: new Types.ObjectId(memberId),
      description: `${removedUser.name} was removed from "${project.name}"`,
      project: project._id,
    });

    return saved;
  }

  async getStats(user: UserDocument) {
    const projects = await this.findAll(user);
    return {
      total: projects.length,
      active: projects.filter((p) => p.status === ProjectStatus.ACTIVE).length,
      completed: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
      onHold: projects.filter((p) => p.status === ProjectStatus.ON_HOLD).length,
    };
  }

  private checkAccess(project: ProjectDocument, user: UserDocument) {
    if (user.role === UserRole.ADMIN) return;
    const userId = (user as any)._id.toString();
    const isMember = project.members.some((m: any) => m._id?.toString() === userId || m.toString() === userId);
    const isLead = isProjectLead(project, userId);
    if (!isMember && !isLead) throw new ForbiddenException('Access denied');
  }

  private checkLeadOrAdmin(project: ProjectDocument, user: UserDocument) {
    if (user.role === UserRole.ADMIN) return;
    const userId = (user as any)._id.toString();
    if (!isProjectLead(project, userId)) {
      throw new ForbiddenException('Only the project lead or admin can perform this action');
    }
  }

  private mergeMemberIds(base: Types.ObjectId[], extra: Types.ObjectId[]): Types.ObjectId[] {
    const seen = new Set<string>();
    const result: Types.ObjectId[] = [];
    for (const id of [...base, ...extra]) {
      const key = id.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(id);
    }
    return result;
  }

  /** Admin always remains createdBy; optional PM is stored as leadId. */
  private async resolveInitialSetup(
    leadId: string | undefined,
    actor: UserDocument,
  ): Promise<{ createdBy: Types.ObjectId; leadId?: Types.ObjectId; members: Types.ObjectId[] }> {
    const actorId = new Types.ObjectId((actor as any)._id.toString());

    if (actor.role === UserRole.ADMIN) {
      const members: Types.ObjectId[] = [actorId];
      let leadObjectId: Types.ObjectId | undefined;

      if (leadId) {
        const lead = await this.usersService.findById(leadId);
        if (lead.role !== UserRole.PROJECT_MANAGER) {
          throw new BadRequestException('Project lead must be a Project Manager');
        }
        if (!lead.isActive) {
          throw new BadRequestException('Project lead account is not active');
        }
        leadObjectId = new Types.ObjectId(leadId);
        members.push(leadObjectId);
      }

      return {
        createdBy: actorId,
        leadId: leadObjectId,
        members: this.mergeMemberIds(members, []),
      };
    }

    if (actor.role === UserRole.PROJECT_MANAGER) {
      return { createdBy: actorId, leadId: actorId, members: [actorId] };
    }

    throw new ForbiddenException('Only admins and project managers can create projects');
  }

  // PRD §03: project name is unique per team. We treat the entire workspace as one team
  // and enforce case-insensitive uniqueness. Pass `excludeId` when validating an update.
  private async assertUniqueName(name: string, excludeId?: any) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter: any = { name: { $regex: `^${escaped}$`, $options: 'i' } };
    if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId.toString()) };
    const existing = await this.projectModel.findOne(filter).lean();
    if (existing) {
      throw new ConflictException('A project with this name already exists');
    }
  }
}
