import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityDocument = Activity & Document;

export enum ActionType {
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  PROJECT_DELETED = 'project_deleted',
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_DELETED = 'task_deleted',
  STATUS_CHANGED = 'status_changed',
  TASK_ASSIGNED = 'task_assigned',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
  PROJECT_OWNERSHIP_TRANSFERRED = 'project_ownership_transferred',
  PROJECT_LEAD_ASSIGNED = 'project_lead_assigned',
  USER_LOGIN = 'user_login',
}

@Schema({ timestamps: true })
export class Activity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actor: Types.ObjectId;

  @Prop({ enum: ActionType, required: true })
  actionType: ActionType;

  @Prop({ required: true })
  entityType: string; // 'project' | 'task' | 'member'

  @Prop({ type: MongooseSchema.Types.ObjectId })
  entityId: Types.ObjectId;

  @Prop({ required: true })
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project' })
  project?: Types.ObjectId;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
