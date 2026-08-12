import { ApplicationsService } from './applications.service';

/**
 * Who is allowed to set the password on an application.
 *
 * This endpoint used to accept an email and a password and nothing else, so
 * knowing that someone had applied was enough to claim their account — and the
 * new profile was seeded with everything they had typed into the form. The
 * setup token, minted only when the emailed code is entered, is what closes it.
 */
const TOKEN = '11111111-2222-3333-4444-555555555555';

function makeService(application: Record<string, unknown> | null = {}) {
  const row = application && {
    id: 'app-1',
    email: 'ada@builders.test',
    fullName: 'Ada Lovelace',
    about: 'Private answers.',
    phone: '+504 1111-2222',
    socialLinksJson: null,
    setupToken: TOKEN,
    setupTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...application,
  };
  const prisma = {
    application: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'ada@builders.test', role: 'MEMBER' }),
    },
  };
  const jwt = { sign: jest.fn().mockReturnValue('signed-token') };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ApplicationsService(
    prisma as never,
    {} as never,
    {} as never,
    jwt as never,
    notifications as never,
  );
  return { service, prisma, jwt };
}

const CREDENTIALS = { email: 'ada@builders.test', password: 'a-good-password', setupToken: TOKEN };

describe('ApplicationsService.createAccountFromApply', () => {
  it('creates the account when the token from the code step is presented', async () => {
    const { service, prisma, jwt } = makeService();

    const session = await service.createAccountFromApply(CREDENTIALS);

    expect(prisma.user.create).toHaveBeenCalled();
    expect(session.accessToken).toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalled();
  });

  it('refuses when no token is presented — the old takeover path', async () => {
    // Knowing the address was the entire requirement before.
    const { service, prisma } = makeService();

    await expect(
      service.createAccountFromApply({ email: 'ada@builders.test', password: 'attacker-chosen' } as never),
    ).rejects.toThrow(/no longer valid/i);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses a token that matches no application', async () => {
    const { service, prisma } = makeService(null);

    await expect(service.createAccountFromApply({ ...CREDENTIALS, setupToken: 'guessed' })).rejects.toThrow(
      /no longer valid/i,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses a valid token paired with somebody else’s email', async () => {
    // The lookup is by token, so the email in the body cannot redirect a good
    // token onto a different application.
    const { service, prisma } = makeService();

    await expect(service.createAccountFromApply({ ...CREDENTIALS, email: 'mallory@evil.test' })).rejects.toThrow(
      /no longer valid/i,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses an expired token', async () => {
    const { service, prisma } = makeService({ setupTokenExpiresAt: new Date(Date.now() - 1000) });

    await expect(service.createAccountFromApply(CREDENTIALS)).rejects.toThrow(/expired/i);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('spends the token, so the same one cannot be replayed', async () => {
    const { service, prisma } = makeService();

    await service.createAccountFromApply(CREDENTIALS);

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { setupToken: null, setupTokenExpiresAt: null } }),
    );
  });

  it('still refuses when an account already exists', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.createAccountFromApply(CREDENTIALS)).rejects.toThrow(/already exists/i);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
