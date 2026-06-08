import { randomBytes } from 'crypto';
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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
    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    const valid = await this.usersService.validatePassword(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  /**
   * Validates the refresh token stored in the HttpOnly cookie, rotates it,
   * and returns a new access token + new refresh token.
   * Cookie format: "${userId}.${randomHex}"
   */
  async refresh(cookieValue: string) {
    const dotIdx = cookieValue.indexOf('.');
    if (dotIdx === -1) throw new UnauthorizedException('Invalid refresh token');

    const userId = cookieValue.slice(0, dotIdx);
    const user = await this.usersService.findByIdWithRefreshToken(userId);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session expired — please log in again');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const valid = await bcrypt.compare(cookieValue, user.refreshTokenHash);
    if (!valid) throw new UnauthorizedException('Session expired — please log in again');

    return this.issueTokens(user as unknown as UserDocument);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.clearRefreshToken(userId);
  }

  private async issueTokens(user: UserDocument) {
    const userId = (user as any)._id.toString();
    const accessToken = this.signAccessToken(user);

    // Opaque refresh token: "{userId}.{40-byte hex}" — userId lets the refresh
    // endpoint find the right user without a full-table hash scan.
    const randomPart = randomBytes(40).toString('hex');
    const refreshToken = `${userId}.${randomPart}`;
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.saveRefreshToken(userId, hash);

    return { user: this.sanitizeUser(user), accessToken, refreshToken };
  }

  private sanitizeUser(user: UserDocument) {
    const obj = (user as any).toObject ? (user as any).toObject() : { ...user };
    delete (obj as any).password;
    delete (obj as any).refreshTokenHash;
    return obj;
  }

  private signAccessToken(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    return this.jwtService.sign(payload);
  }

  private isPublicRegistrationAllowed(): boolean {
    const explicit = this.config.get<string>('ALLOW_PUBLIC_REGISTER');
    if (explicit != null && explicit !== '') {
      return explicit === 'true' || explicit === '1';
    }
    return this.config.get<string>('NODE_ENV') !== 'production';
  }
}
