import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddCommentDto {
  @ApiProperty({ example: 'Looks good — please review the API docs.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}

export class UpdateCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
