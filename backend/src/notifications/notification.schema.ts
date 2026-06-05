import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_DUE_SOON = 'task_due_soon',
  COMMENT_ADDED = 'comment_added',
  MEMBER_ADDED = 'member_added',
}

@Schema({ timestamps: true })
export class Notification {
  // Recipient — the user who should see this in their bell dropdown
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  recipient: Types.ObjectId;

  // Actor — the user who triggered the notification (optional, system events have no actor)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  actor?: Types.ObjectId;

  @Prop({ enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop()
  message?: string;

  // Related entities for navigation
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task' })
  task?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project' })
  project?: Types.ObjectId;

  @Prop({ default: false, index: true })
  read: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ recipient: 1, createdAt: -1 });
