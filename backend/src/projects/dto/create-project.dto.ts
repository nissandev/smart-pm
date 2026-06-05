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
      'Admin only. User id of the Project Manager who will own this project. ' +
      'When set, createdBy is the PM and the admin remains a member.',
  })
  @IsOptional()
  @IsMongoId()
  ownerId?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
