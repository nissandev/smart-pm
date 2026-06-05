import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AddMemberDto {
  @ApiPropertyOptional({
    description:
      'Admin only. When true and the added user is a Project Manager, ' +
      'transfers project ownership (createdBy) to them. The previous owner stays a member.',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  makeOwner?: boolean;
}
