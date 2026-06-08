import {
  Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TeamGroup, TeamGroupDocument } from './group.schema';
import { CreateGroupDto, UpdateGroupDto } from './dto/create-group.dto';
import { UserRole, UserDocument } from '../users/user.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(TeamGroup.name) private groupModel: Model<TeamGroupDocument>,
    private usersService: UsersService,
  ) {}

  async findAll(user: UserDocument): Promise<TeamGroupDocument[]> {
    let query: Record<string, any>;

    if (user.role === UserRole.ADMIN) {
      query = {};
    } else if (user.role === UserRole.PROJECT_MANAGER) {
      query = { leadId: user._id };
    } else if (user.role === UserRole.MEMBER) {
      query = { memberIds: (user as any)._id };
    } else {
      throw new ForbiddenException('Access denied');
    }

    return this.groupModel
      .find(query)
      .populate('leadId', 'name email role')
      .populate('memberIds', 'name email role createdAt')
      .populate('createdBy', 'name email')
      .sort({ name: 1 })
      .exec();
  }

  async findById(id: string, user?: UserDocument): Promise<TeamGroupDocument> {
    const group = await this.groupModel
      .findById(id)
      .populate('leadId', 'name email role')
      .populate('memberIds', 'name email role createdAt')
      .populate('createdBy', 'name email');

    if (!group) throw new NotFoundException('Group not found');

    if (user && user.role === UserRole.PROJECT_MANAGER) {
      const leadId = ((group.leadId as any)?._id ?? group.leadId).toString();
      if (leadId !== (user as any)._id.toString()) {
        throw new ForbiddenException('You can only access groups you lead');
      }
    }

    return group;
  }

  /** Load group for project creation — admin only, no PM scope check. */
  async findByIdForProject(id: string): Promise<TeamGroupDocument> {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async create(dto: CreateGroupDto, user: UserDocument): Promise<TeamGroupDocument> {
    await this.assertUniqueName(dto.name);
    await this.validateGroupUsers(dto.leadId, dto.memberIds);

    const memberObjectIds = this.normalizeMemberIds(dto.leadId, dto.memberIds);
    if (memberObjectIds.length === 0) {
      throw new BadRequestException('Select at least one team member under this PM');
    }

    const group = new this.groupModel({
      name: dto.name.trim(),
      leadId: new Types.ObjectId(dto.leadId),
      memberIds: memberObjectIds,
      createdBy: (user as any)._id,
    });

    const saved = await group.save();
    return saved.populate([
      { path: 'leadId', select: 'name email role' },
      { path: 'memberIds', select: 'name email role createdAt' },
      { path: 'createdBy', select: 'name email' },
    ]);
  }

  async update(id: string, dto: UpdateGroupDto): Promise<TeamGroupDocument> {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Group not found');

    if (dto.name) await this.assertUniqueName(dto.name, id);

    const leadId = dto.leadId ?? group.leadId.toString();
    const memberIds = dto.memberIds ?? group.memberIds.map((m) => m.toString());
    await this.validateGroupUsers(leadId, memberIds);

    if (dto.name) group.name = dto.name.trim();
    if (dto.leadId) group.leadId = new Types.ObjectId(dto.leadId);
    if (dto.memberIds) {
      group.memberIds = this.normalizeMemberIds(leadId, memberIds);
    } else if (dto.leadId) {
      group.memberIds = this.normalizeMemberIds(leadId, group.memberIds.map((m) => m.toString()));
    }

    if (group.memberIds.length === 0) {
      throw new BadRequestException('Select at least one team member under this PM');
    }

    const saved = await group.save();
    return saved.populate([
      { path: 'leadId', select: 'name email role' },
      { path: 'memberIds', select: 'name email role createdAt' },
      { path: 'createdBy', select: 'name email' },
    ]);
  }

  async remove(id: string): Promise<void> {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Group not found');
    await group.deleteOne();
  }

  private normalizeMemberIds(leadId: string, memberIds: string[]): Types.ObjectId[] {
    const unique = new Set(memberIds.map((id) => id.toString()));
    unique.delete(leadId.toString());
    return Array.from(unique).map((id) => new Types.ObjectId(id));
  }

  private async validateGroupUsers(leadId: string, memberIds: string[]) {
    const lead = await this.usersService.findById(leadId);
    if (lead.role !== UserRole.PROJECT_MANAGER) {
      throw new BadRequestException('Group lead must be a Project Manager');
    }
    if (!lead.isActive) {
      throw new BadRequestException('Group lead account is not active');
    }

    for (const memberId of memberIds) {
      if (memberId === leadId) continue;
      const member = await this.usersService.findById(memberId);
      if (!member.isActive) {
        throw new BadRequestException(`Member account is not active: ${member.email}`);
      }
      if (member.role === UserRole.ADMIN) {
        throw new BadRequestException('Admins cannot be added to groups');
      }
      if (member.role !== UserRole.MEMBER) {
        throw new BadRequestException('Only Member-role users can be added to a PM team group');
      }
    }
  }

  private async assertUniqueName(name: string, excludeId?: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter: Record<string, unknown> = { name: { $regex: `^${escaped}$`, $options: 'i' } };
    if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };
    const existing = await this.groupModel.findOne(filter).lean();
    if (existing) {
      throw new ConflictException('A group with this name already exists');
    }
  }
}
