import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { isAdminRole } from '../users/roles';
import { isValidAdminAccessKey } from './admin-access';
import { SUPER_ADMIN_ONLY } from './super-admin.decorator';
import { SessionPayload, sessionMatches } from '../auth/session';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
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

      let payload: SessionPayload;
      try {
        payload = this.jwt.verify<SessionPayload>(authorization.slice('Bearer '.length));
      } catch {
        throw new UnauthorizedException('Admin session is invalid or expired.');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, sessionVersion: true },
      });
      if (!sessionMatches(payload, user)) {
        throw new UnauthorizedException('Admin session is invalid or expired.');
      }

      if (!user || !isAdminRole(user.role)) {
        throw new UnauthorizedException('Admin role required.');
      }

      request.adminAccess = { userId: user.id, role: user.role, via: 'session' };
      this.requireTier(context, user.role);
      return true;
    }

    request.adminAccess = { role: 'SUPER_ADMIN', via: 'key' };
    return true;
  }

  /** Routes marked @SuperAdminOnly() refuse every other admin tier. */
  private requireTier(context: ExecutionContext, role: string): void {
    const superOnly = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (superOnly && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a Super Admin can do this.');
    }
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
