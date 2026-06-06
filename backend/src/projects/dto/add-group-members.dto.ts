import { IsBoolean, IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AddGroupMembersDto {
  @ApiProperty({ description: 'Team group id — all members not already on the project are added' })
  @IsMongoId()
  teamId: string;

  @ApiPropertyOptional({
    description: 'When true, sets the group PM as project lead. Admin owner is unchanged.',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  makeLead?: boolean;

  @ApiPropertyOptional({ description: 'Deprecated alias for makeLead.' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  makeOwner?: boolean;
}
