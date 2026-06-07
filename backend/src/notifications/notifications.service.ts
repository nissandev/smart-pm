import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './notification.schema';

interface CreateNotificationInput {
  recipient: string | Types.ObjectId;
  actor?: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message?: string;
  task?: string | Types.ObjectId;
  project?: string | Types.ObjectId;
}

@Injectable()
export class NotificationsService {
  /** Throttle due-soon sync — at most once per user every 5 minutes. */
  private dueSoonSyncAt = new Map<string, number>();
  private static readonly DUE_SOON_SYNC_MS = 5 * 60 * 1000;

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationDocument> {
    // Don't notify self — actor and recipient being the same is noise.
    if (input.actor && input.recipient.toString() === input.actor.toString()) {
      return null as any;
    }
    const created = new this.notificationModel(input);
    return created.save();
  }

  async findForUser(userId: string, opts: { limit?: number; unreadOnly?: boolean } = {}) {
    const query: any = { recipient: new Types.ObjectId(userId) };
    if (opts.unreadOnly) query.read = false;
    return this.notificationModel
      .find(query)
      .populate('actor', 'name email avatar')
      .populate('task', 'title')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(opts.limit ?? 20)
      .lean()
      .exec();
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipient: new Types.ObjectId(userId),
      read: false,
    });
  }

  async markRead(userId: string, id: string) {
    await this.notificationModel.updateOne(
      { _id: new Types.ObjectId(id), recipient: new Types.ObjectId(userId) },
      { $set: { read: true } },
    );
  }

  async markAllRead(userId: string) {
    await this.notificationModel.updateMany(
      { recipient: new Types.ObjectId(userId), read: false },
      { $set: { read: true } },
    );
  }

  async deleteAllForUser(userId: string) {
    await this.notificationModel.deleteMany({ recipient: new Types.ObjectId(userId) });
  }

  /**
   * "Task due soon" virtual notifications: tasks assigned to the user that are
   * due within 24 hours and not yet completed. Created lazily on read so we don't
   * need a cron job.
   */
  /** Returns true when sync should run (caller fetches due tasks then calls syncDueSoon). */
  shouldSyncDueSoon(userId: string): boolean {
    const last = this.dueSoonSyncAt.get(userId) ?? 0;
    if (Date.now() - last < NotificationsService.DUE_SOON_SYNC_MS) {
      return false;
    }
    this.dueSoonSyncAt.set(userId, Date.now());
    return true;
  }

  async syncDueSoon(userId: string, dueTasks: Array<{ _id: any; title: string; project?: any; dueDate: Date }>) {
    if (!dueTasks.length) return;
    const recipient = new Types.ObjectId(userId);
    const ops = dueTasks.map((t) => ({
      updateOne: {
        filter: { recipient, type: NotificationType.TASK_DUE_SOON, task: t._id },
        update: {
          $setOnInsert: {
            recipient,
            type: NotificationType.TASK_DUE_SOON,
            title: 'Task due soon',
            message: `"${t.title}" is due ${this.relativeDay(t.dueDate)}`,
            task: t._id,
            project: t.project?._id ?? t.project,
            read: false,
          },
        },
        upsert: true,
      },
    }));
    if (ops.length) await this.notificationModel.bulkWrite(ops as any);
  }

  private relativeDay(d: Date | string): string {
    const due = new Date(d);
    const now = new Date();
    const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    return `in ${diffDays} days`;
  }
}
