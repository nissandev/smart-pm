import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

// Cache auth user for 30s to avoid a DB hit on every authenticated request.
// Deactivated users may continue for up to 30s after deactivation — acceptable tradeoff.
const AUTH_CACHE_TTL_MS = 30_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly cache = new Map<string, { user: any; expiresAt: number }>();

  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  /** Call when a user is updated or deactivated to force re-validation on next request. */
  invalidate(userId: string) {
    this.cache.delete(userId);
  }

  async validate(payload: { sub: string; email?: string; role?: string }) {
    const cached = this.cache.get(payload.sub);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.user;
    }

    const user = await this.usersService.findByIdForAuth(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.isActive === false) throw new UnauthorizedException('Account is disabled');

    this.cache.set(payload.sub, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    return user;
  }
}
