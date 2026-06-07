import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole, UserDocument } from '../users/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  /** Public signup — always creates a Team Member account (when enabled). */
  async register(dto: CreateUserDto) {
    if (!this.isPublicRegistrationAllowed()) {
      throw new ForbiddenException('Public registration is disabled on this server');
    }
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: UserRole.MEMBER,
    });
    const token = this.signToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.usersService.validatePassword(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    const token = this.signToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (user && (await this.usersService.validatePassword(password, user.password))) {
      return user;
    }
    return null;
  }

  private sanitizeUser(user: UserDocument) {
    const obj = user.toObject ? user.toObject() : { ...user };
    delete (obj as any).password;
    return obj;
  }

  /** ALLOW_PUBLIC_REGISTER=true|false; defaults to enabled in dev, disabled in production. */
  private isPublicRegistrationAllowed(): boolean {
    const explicit = this.config.get<string>('ALLOW_PUBLIC_REGISTER');
    if (explicit != null && explicit !== '') {
      return explicit === 'true' || explicit === '1';
    }
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  private signToken(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    return this.jwtService.sign(payload);
  }
}
