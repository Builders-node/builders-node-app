import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { SessionPayload, sessionMatches } from './session';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

/**
 * Member routes an admin may not use on somebody else's behalf, even to read.
 * The GDPR export is the member's whole file; the pass is a credential that
 * opens doors; the Discord link would let an admin finish the OAuth with their
 * own Discord account and collect the member's roles.
 */
const OWNER_ONLY_PATH = /\/(export|pass|discord)(\/|$)/;

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
      method?: string;
      path?: string;
      url?: string;
      user?: SessionPayload;
    }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Login required.');
    }

    let payload: SessionPayload;
    try {
      payload = this.jwt.verify<SessionPayload>(authorization.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Session is invalid or expired.');
    }

    /**
     * Checked against the database on every request, not just the signature.
     * A token stays valid for a week, and before this nothing could end one
     * early — not a password reset, not a stolen phone. One primary-key read
     * is what it costs to make "sign out everywhere" true.
     */
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, sessionVersion: true },
    });
    if (!sessionMatches(payload, user)) {
      throw new UnauthorizedException('Session is invalid or expired.');
    }
    request.user = payload;

    // Users may only touch their own account. Admins may look at a member's
    // (reviewing an E-Residency proof needs it) but not act as them: writes on
    // someone else's account belong in /admin routes, which are audited.
    const reachingForSomeoneElse = Boolean(request.params?.userId) && request.params!.userId !== payload.sub;
    if (reachingForSomeoneElse) {
      const isAdmin = ADMIN_ROLES.includes(user!.role);
      const isRead = (request.method ?? 'GET').toUpperCase() === 'GET';
      const path = request.path ?? request.url ?? '';
      if (!isAdmin || !isRead || OWNER_ONLY_PATH.test(path)) {
        throw new ForbiddenException('You can only access your own account.');
      }
    }

    return true;
  }
}
