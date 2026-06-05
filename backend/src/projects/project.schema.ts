import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ProjectDocument = Project & Document;

export enum ProjectStatus {
  ACTIVE = 'Active',
  COMPLETED = 'Completed',
  ON_HOLD = 'On Hold',
}

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true, maxlength: 100 })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  deadline: Date;

  @Prop({ enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  members: Types.ObjectId[];
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
