import { IsBoolean, IsMongoId, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SyncGroupDto {
  @ApiPropertyOptional({
    description: 'Team group to sync from. Defaults to the project’s linked group (teamId).',
  })
  @IsOptional()
  @IsMongoId()
  teamId?: string;

  @ApiPropertyOptional({
    description: 'Remove project members who are no longer in the group (admin owner is never removed).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  removeAbsent?: boolean;

  @ApiPropertyOptional({
    description: 'Set project lead to the group PM when it differs from the current lead.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  updateLead?: boolean;
}
