import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { UserRole } from '../user.schema';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'SecurePass1', minLength: 8 })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ enum: UserRole, default: UserRole.MEMBER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
