import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';

type SessionPayload = {
  sub: string;
  email: string;
  role?: string;
};

const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      params?: Record<string, string | undefined>;
      user?: SessionPayload;
    }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Login required.');
    }

    try {
      const payload = this.jwt.verify<SessionPayload>(authorization.slice('Bearer '.length));
      request.user = payload;

      // Users may only touch their own account; admins may access any user
      // (needed e.g. for reviewing an E-Residency proof file).
      const reachingForSomeoneElse = Boolean(request.params?.userId) && request.params!.userId !== payload.sub;
      if (reachingForSomeoneElse && !(await this.isStillAdmin(payload))) {
        throw new ForbiddenException('You can only access your own account.');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Session is invalid or expired.');
    }
  }

  /**
   * Confirm the admin claim against the database, not the token.
   *
   * Sessions last a week and nothing revokes them, so a role baked into a token
   * outlives the role itself: someone demoted on Monday still carried
   * `role: SUPER_ADMIN` until the following Monday and could read, edit and
   * export any member's account with it. AdminGuard already re-checked the
   * database for /admin routes; this is the same check for the member routes
   * that admins are allowed to reach on someone else's behalf.
   *
   * Only runs when a request actually reaches for another user's data, so the
   * ordinary self-access path costs nothing extra.
   */
  private async isStillAdmin(payload: SessionPayload): Promise<boolean> {
    if (!ADMIN_ROLES.includes(payload.role ?? '')) return false;
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true } });
    return Boolean(user && ADMIN_ROLES.includes(user.role));
  }
}
