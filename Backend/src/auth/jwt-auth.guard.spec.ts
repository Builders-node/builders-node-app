import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * What a session token is good for.
 *
 * Pinned: a token dies when its user's session version moves on (password
 * reset, an account reclaimed from a squatter), a non-session token signed with
 * the same secret is never a login, and an admin can read a member's account
 * but not act as them.
 */
function makeGuard(payload: Record<string, unknown>, user: { role: string; sessionVersion: number } | null) {
  const jwt = { verify: jest.fn().mockReturnValue(payload) };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  return new JwtAuthGuard(jwt as never, prisma as never);
}

function context(request: Record<string, unknown>) {
  const full = { headers: { authorization: 'Bearer t' }, method: 'GET', path: '/users/me/profile', ...request };
  return { switchToHttp: () => ({ getRequest: () => full }) } as never;
}

describe('JwtAuthGuard', () => {
  it('lets a current session through', async () => {
    const guard = makeGuard({ sub: 'u1', sv: 2 }, { role: 'MEMBER', sessionVersion: 2 });
    await expect(guard.canActivate(context({ params: { userId: 'u1' } }))).resolves.toBe(true);
  });

  it('treats a token from before session versions as version 0', async () => {
    const guard = makeGuard({ sub: 'u1' }, { role: 'MEMBER', sessionVersion: 0 });
    await expect(guard.canActivate(context({}))).resolves.toBe(true);
  });

  it('refuses a session issued before the password was reset', async () => {
    const guard = makeGuard({ sub: 'u1', sv: 0 }, { role: 'MEMBER', sessionVersion: 1 });
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses the Discord OAuth state as a login', async () => {
    const guard = makeGuard({ sub: 'u1', purpose: 'discord' }, { role: 'SUPER_ADMIN', sessionVersion: 0 });
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lets an admin read a member's account", async () => {
    const guard = makeGuard({ sub: 'admin' }, { role: 'MODERATOR', sessionVersion: 0 });
    await expect(
      guard.canActivate(context({ params: { userId: 'u1' }, path: '/users/u1/residency/proof' })),
    ).resolves.toBe(true);
  });

  it("refuses an admin writing to a member's account", async () => {
    const guard = makeGuard({ sub: 'admin' }, { role: 'SUPER_ADMIN', sessionVersion: 0 });
    await expect(
      guard.canActivate(context({ params: { userId: 'u1' }, method: 'PATCH', path: '/users/u1/profile' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses an admin the member's export, pass and Discord link, even to read", async () => {
    const guard = makeGuard({ sub: 'admin' }, { role: 'SUPER_ADMIN', sessionVersion: 0 });
    for (const path of ['/users/u1/export', '/users/u1/pass', '/users/u1/discord/authorize-url']) {
      await expect(guard.canActivate(context({ params: { userId: 'u1' }, path }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });

  it("refuses a member reaching for someone else's account", async () => {
    const guard = makeGuard({ sub: 'u2' }, { role: 'MEMBER', sessionVersion: 0 });
    await expect(guard.canActivate(context({ params: { userId: 'u1' } }))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
