import {
  Controller, Get, Patch, Delete, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MAX_LIMIT } from '../common/pagination.util';
import { Task, TaskDocument, TaskStatus } from '../tasks/task.schema';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
  ) {}

  // Refresh "task due soon" virtual notifications for the current user, then
  // return the most recent N notifications and unread count.
  @Get()
  async list(@Request() req: any, @Query('limit') limit = '20') {
    const userId = req.user._id.toString();

    if (this.notifications.shouldSyncDueSoon(userId)) {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dueSoonTasks = await this.taskModel
        .find({
          assignedTo: req.user._id,
          status: { $ne: TaskStatus.COMPLETED },
          dueDate: { $gte: now, $lte: tomorrow },
        })
        .select('_id title project dueDate')
        .lean();
      await this.notifications.syncDueSoon(userId, dueSoonTasks as any);
    }

    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 20));

    const [items, unread] = await Promise.all([
      this.notifications.findForUser(userId, { limit: safeLimit }),
      this.notifications.unreadCount(userId),
    ]);
    return { items, unread };
  }

  @Get('unread-count')
  async unread(@Request() req: any) {
    const count = await this.notifications.unreadCount(req.user._id.toString());
    return { count };
  }

  @Patch(':id/read')
  async markRead(@Request() req: any, @Param('id') id: string) {
    await this.notifications.markRead(req.user._id.toString(), id);
    return { ok: true };
  }

  @Patch('read-all')
  async markAllRead(@Request() req: any) {
    await this.notifications.markAllRead(req.user._id.toString());
    return { ok: true };
  }

  @Delete()
  async clearAll(@Request() req: any) {
    await this.notifications.deleteAllForUser(req.user._id.toString());
    return { ok: true };
  }
}
