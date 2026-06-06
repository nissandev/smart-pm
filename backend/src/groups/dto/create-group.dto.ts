import {
  IsArray, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ example: 'Design Squad' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Project Manager who leads this group' })
  @IsMongoId()
  leadId: string;

  @ApiProperty({ type: [String], description: 'Team member user ids' })
  @IsArray()
  @IsMongoId({ each: true })
  memberIds: string[];
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}
