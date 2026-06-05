import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type TaskDocument = Task & Document;

export enum TaskPriority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum TaskStatus {
  TODO = 'Todo',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
}

@Schema({ timestamps: true })
export class Task {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true })
  project: Types.ObjectId;

  @Prop({ required: true, maxlength: 150 })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Prop({ enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({
    type: [
      {
        url: { type: String, required: true },
        name: { type: String, required: true },
        size: { type: Number },
        mimeType: { type: String },
        uploadedBy: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  attachments: Array<{
    url: string;
    name: string;
    size?: number;
    mimeType?: string;
    uploadedBy?: Types.ObjectId;
    uploadedAt?: Date;
  }>;

  @Prop({
    type: [
      {
        author: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  comments: Array<{
    author: Types.ObjectId;
    text: string;
    createdAt: Date;
  }>;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Compound index: title unique per project
TaskSchema.index({ project: 1, title: 1 }, { unique: true });
