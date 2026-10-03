import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isAdminRole } from '../users/roles';
import type { SessionPayload } from './session';

/**
 * Community amenities are for members. Runs after JwtAuthGuard.
 *
 * Signing up is open and gives anyone an applicant account, and booking a car
 * or a cleaning slot only ever checked that a session existed — so a handful of
 * throwaway accounts could hold every community car indefinitely. Events
 * already had this rule; the other shared resources now do too.
 *
 * Admins pass, so the team can try a flow without being a member themselves.
 */
@Injectable()
export class ActiveMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: SessionPayload }>();
    const userId = request.user?.sub;
    if (!userId) throw new ForbiddenException('Login required.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, membership: { select: { status: true } } },
    });
    if (user && (user.membership?.status === 'ACTIVE_MEMBER' || isAdminRole(user.role))) return true;

    throw new ForbiddenException('This is available to active members.');
  }
}
