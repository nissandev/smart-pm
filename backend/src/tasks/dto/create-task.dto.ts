import {
  IsDateString, IsEnum, IsMongoId, IsNotEmpty,
  IsOptional, IsString, MaxLength,
} from 'class-validator';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '../task.schema';

export class CreateTaskDto {
  @ApiProperty()
  @IsMongoId()
  project: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @ApiProperty({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}

export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['project'] as const)) {}
