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

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private activityService: ActivityService,
    private notifications: NotificationsService,
    private usersService: UsersService,
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

    const { createdBy, members } = await this.resolveInitialOwner(dto.ownerId, user);
    const { ownerId: _ownerId, ...projectFields } = dto;

    const project = new this.projectModel({
      ...projectFields,
      createdBy,
      members,
    });
    const saved = await project.save();
    await saved.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'members', select: 'name email role' },
    ]);

    const ownerName = (saved.createdBy as any)?.name ?? 'owner';
    const delegated = createdBy.toString() !== (user as any)._id.toString();
    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.PROJECT_CREATED,
      entityType: 'project',
      entityId: saved._id,
      description: delegated
        ? `Project "${saved.name}" was created (owner: ${ownerName})`
        : `Project "${saved.name}" was created`,
      project: saved._id,
    });

    if (delegated) {
      await this.notifications.create({
        recipient: createdBy,
        actor: (user as any)._id,
        type: NotificationType.MEMBER_ADDED,
        title: 'You are now the owner of a project',
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
          ? { createdBy: user._id }
          : { members: user._id };

    return this.projectModel
      .find(query)
      .populate('createdBy', 'name email')
      .populate({ path: 'members', model: 'User', select: 'name email role' })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string, user: UserDocument): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate({ path: 'members', model: 'User', select: 'name email role avatar' });

    if (!project) throw new NotFoundException('Project not found');
    this.checkAccess(project, user);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: UserDocument): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(id);
    if (!project) throw new NotFoundException('Project not found');
    this.checkOwnerOrAdmin(project, user);

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
      .populate('createdBy', 'name email')
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
    this.checkOwnerOrAdmin(project, user);

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
    makeOwner = false,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    this.checkOwnerOrAdmin(project, user);

    const memberObjectId = new Types.ObjectId(memberId);
    if (project.members.some((m) => m.equals(memberObjectId))) {
      throw new BadRequestException('User is already a member');
    }

    const memberUser = await this.usersService.findById(memberId);
    if (!memberUser.isActive) {
      throw new BadRequestException('Cannot add an inactive user');
    }

    if (makeOwner) {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only admins can transfer project ownership');
      }
      if (memberUser.role !== UserRole.PROJECT_MANAGER) {
        throw new BadRequestException('Only Project Managers can be made project owner');
      }
    }

    project.members.push(memberObjectId);

    const previousOwnerId = project.createdBy.toString();
    if (makeOwner) {
      project.createdBy = memberObjectId;
      // Keep the previous owner in members so they retain access.
      const prevOwnerObjectId = new Types.ObjectId(previousOwnerId);
      if (!project.members.some((m) => m.equals(prevOwnerObjectId))) {
        project.members.push(prevOwnerObjectId);
      }
    }

    const saved = await project.save();
    await saved.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'members', select: 'name email role' },
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

    if (makeOwner) {
      await this.activityService.log({
        actor: (user as any)._id,
        actionType: ActionType.PROJECT_OWNERSHIP_TRANSFERRED,
        entityType: 'project',
        entityId: project._id,
        description: `Ownership of "${project.name}" was transferred to ${memberUser.name}`,
        project: project._id,
      });

      await this.notifications.create({
        recipient: memberObjectId,
        actor: (user as any)._id,
        type: NotificationType.MEMBER_ADDED,
        title: 'You are now the owner of a project',
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
    this.checkOwnerOrAdmin(project, user);

    project.members = project.members.filter((m) => !m.equals(new Types.ObjectId(memberId)));
    const saved = await project.save();

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.MEMBER_REMOVED,
      entityType: 'member',
      entityId: new Types.ObjectId(memberId),
      description: `A member was removed from "${project.name}"`,
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
    const isOwner = project.createdBy.toString() === userId;
    if (!isMember && !isOwner) throw new ForbiddenException('Access denied');
  }

  private checkOwnerOrAdmin(project: ProjectDocument, user: UserDocument) {
    if (user.role === UserRole.ADMIN) return;
    if (project.createdBy.toString() !== (user as any)._id.toString()) {
      throw new ForbiddenException('Only the project owner or admin can perform this action');
    }
  }

  /** Admin may delegate ownership to a PM at creation time. */
  private async resolveInitialOwner(
    ownerId: string | undefined,
    actor: UserDocument,
  ): Promise<{ createdBy: Types.ObjectId; members: Types.ObjectId[] }> {
    const actorId = new Types.ObjectId((actor as any)._id.toString());

    if (!ownerId) {
      return { createdBy: actorId, members: [actorId] };
    }

    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can assign a project owner');
    }

    const owner = await this.usersService.findById(ownerId);
    if (owner.role !== UserRole.PROJECT_MANAGER) {
      throw new BadRequestException('Project owner must be a Project Manager');
    }
    if (!owner.isActive) {
      throw new BadRequestException('Project owner account is not active');
    }

    const ownerObjectId = new Types.ObjectId(ownerId);
    const members = [actorId, ownerObjectId].filter(
      (id, idx, arr) => arr.findIndex((x) => x.equals(id)) === idx,
    );

    return { createdBy: ownerObjectId, members };
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
