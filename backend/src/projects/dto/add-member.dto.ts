import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AddMemberDto {
  @ApiPropertyOptional({
    description:
      'When true and the added user is a Project Manager, sets them as project lead. ' +
      'The admin owner (createdBy) is unchanged.',
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
