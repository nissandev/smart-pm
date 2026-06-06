import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProjectStatus } from '../project.schema';

export class CreateProjectDto {
  @ApiProperty({ example: 'E-Commerce App' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  deadline: string;

  @ApiProperty({ enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description:
      'Admin only. PM user id who will lead this project. Admin stays the project owner.',
  })
  @IsOptional()
  @IsMongoId()
  leadId?: string;

  @ApiPropertyOptional({
    description: 'Deprecated alias for leadId.',
  })
  @IsOptional()
  @IsMongoId()
  ownerId?: string;

  @ApiPropertyOptional({
    description:
      'Optional team group. Members are copied into the project at creation (snapshot). ' +
      'When leadId is omitted, the group PM lead becomes project lead.',
  })
  @IsOptional()
  @IsMongoId()
  teamId?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
