import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type TeamGroupDocument = TeamGroup & Document;

@Schema({ timestamps: true, collection: 'groups' })
export class TeamGroup {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  leadId: Types.ObjectId;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  memberIds: Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export const TeamGroupSchema = SchemaFactory.createForClass(TeamGroup);

TeamGroupSchema.index({ leadId: 1 });
TeamGroupSchema.index({ memberIds: 1 });
TeamGroupSchema.index({ name: 1 });
