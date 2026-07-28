import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { isAdminRole } from '../users/roles';
import { isValidAdminAccessKey } from './admin-access';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { adminAccess?: { userId?: string; role: string; via: 'key' | 'session' } }>();
    const providedKey = request.header('x-admin-key');
    const expectedKey = this.resolveAdminKey();

    // With no configured key the header path is disabled entirely; admins must
    // authenticate with a real session (Bearer token) instead.
    if (!expectedKey || !isValidAdminAccessKey(providedKey, expectedKey)) {
      const authorization = request.header('authorization');

      if (!authorization?.startsWith('Bearer ')) {
        throw new UnauthorizedException('Admin role required.');
      }

      let payload: { sub: string };
      try {
        payload = this.jwt.verify<{ sub: string }>(authorization.slice('Bearer '.length));
      } catch {
        throw new UnauthorizedException('Admin session is invalid or expired.');
      }

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } });

      if (!user || !isAdminRole(user.role)) {
        throw new UnauthorizedException('Admin role required.');
      }

      request.adminAccess = { userId: user.id, role: user.role, via: 'session' };
      return true;
    }

    request.adminAccess = { role: 'SUPER_ADMIN', via: 'key' };
    return true;
  }

  /**
   * The break-glass admin key. Required to be set explicitly; the insecure
   * `terminus-local-admin` default is only honoured outside production so local
   * tooling still works. In production a missing key disables the header path.
   */
  private resolveAdminKey(): string | undefined {
    const key = this.config.get<string>('ADMIN_ACCESS_KEY');
    if (key && key.trim() !== '') return key;
    return process.env.NODE_ENV === 'production' ? undefined : 'terminus-local-admin';
  }
}
