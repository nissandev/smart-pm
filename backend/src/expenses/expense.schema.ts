import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ExpenseDocument = Expense & Document;

export enum ExpenseCategory {
  HOSTING = 'Hosting',
  AI_API = 'AI / API',
  TOOLS = 'Tools',
  DOMAIN = 'Domain',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Expense {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true, index: true })
  project: Types.ObjectId;

  @Prop({ enum: ExpenseCategory, required: true })
  category: ExpenseCategory;

  @Prop({ required: true, maxlength: 200 })
  description: string;

  @Prop({ required: true, min: 0.01 })
  amount: number;

  @Prop({ default: 'USD', maxlength: 3 })
  currency: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ maxlength: 500 })
  notes?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
