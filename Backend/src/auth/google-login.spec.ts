import { AuthService } from './auth.service';

/**
 * Signing in with Google.
 *
 * The ID token itself is verified by google-auth-library against the configured
 * client id, so what's worth pinning here is everything around that: refusing to
 * run unconfigured, refusing an account Google won't vouch for, and what happens
 * to a user record that already exists.
 */
/** Pass clientId: '' for the unconfigured case — an unset env var reads as empty. */
function makeService(existing: Record<string, unknown> | null, clientId = 'client-123') {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'new-user', email: 'ada@gmail.test', role: 'MEMBER' }),
    },
  };
  const config = { get: (key: string) => (key === 'GOOGLE_CLIENT_ID' ? clientId : undefined) };
  const jwt = { sign: () => 'signed-token' };
  const service = new AuthService(prisma as never, jwt as never, config as never, {} as never);
  return { service, prisma };
}

/** Stand in for a verified Google ID token without reaching Google. */
function acceptToken(service: AuthService, payload: Record<string, unknown> = {}) {
  const client = (service as unknown as { googleClient: { verifyIdToken: unknown } }).googleClient;
  client.verifyIdToken = jest.fn().mockResolvedValue({
    getPayload: () => ({ email: 'ada@gmail.test', email_verified: true, name: 'Ada Lovelace', ...payload }),
  });
}

describe('AuthService.googleLogin', () => {
  it('refuses when the server has no client id — rather than trusting the token', async () => {
    const { service } = makeService(null, '');
    await expect(service.googleLogin({ credential: 'x' })).rejects.toThrow(/not configured/);
  });

  it('refuses a token Google will not verify', async () => {
    const { service } = makeService(null);
    const client = (service as unknown as { googleClient: { verifyIdToken: unknown } }).googleClient;
    client.verifyIdToken = jest.fn().mockRejectedValue(new Error('bad token'));
    await expect(service.googleLogin({ credential: 'x' })).rejects.toThrow(/could not be verified/);
  });

  it('refuses an account whose email Google has not verified', async () => {
    const { service } = makeService(null);
    acceptToken(service, { email_verified: false });
    await expect(service.googleLogin({ credential: 'x' })).rejects.toThrow(/no verified email/);
  });

  it('creates an account on first sign-in', async () => {
    const { service, prisma } = makeService(null);
    acceptToken(service);
    const session = await service.googleLogin({ credential: 'x' });
    expect(prisma.user.create).toHaveBeenCalled();
    expect(session.accessToken).toBe('signed-token');
  });

  it('marks an existing unverified email as verified — Google vouches for it', async () => {
    const { service, prisma } = makeService({ id: 'u1', email: 'ada@gmail.test', role: 'MEMBER', emailVerifiedAt: null, mustChangePassword: false });
    acceptToken(service);
    await service.googleLogin({ credential: 'x' });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { emailVerifiedAt: expect.any(Date) } }));
  });

  it('clears a pending password setup', async () => {
    // The flag means "still on the temporary password we mailed them". Someone
    // who just signed in with Google isn't, and would otherwise read as
    // "Setup required" in the admin list forever.
    const { service, prisma } = makeService({ id: 'u1', email: 'ada@gmail.test', role: 'MEMBER', emailVerifiedAt: new Date(), mustChangePassword: true });
    acceptToken(service);
    await service.googleLogin({ credential: 'x' });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { mustChangePassword: false } }));
  });

  it('writes nothing when there is nothing to settle', async () => {
    const { service, prisma } = makeService({ id: 'u1', email: 'ada@gmail.test', role: 'MEMBER', emailVerifiedAt: new Date(), mustChangePassword: false });
    acceptToken(service);
    await service.googleLogin({ credential: 'x' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps the existing role — signing in with Google is not a demotion', async () => {
    const { service } = makeService({ id: 'u1', email: 'ada@gmail.test', role: 'SUPER_ADMIN', emailVerifiedAt: new Date(), mustChangePassword: false });
    acceptToken(service);
    const session = await service.googleLogin({ credential: 'x' });
    expect(session.user.role).toBe('SUPER_ADMIN');
  });
});
