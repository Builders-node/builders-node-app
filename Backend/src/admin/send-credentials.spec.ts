import { AdminService } from './admin.service';

/**
 * sendCredentials mints a temporary password and forces a reset on next login,
 * so it may only ever reach an applicant who has no account at all.
 *
 * This matters more than it used to: staff can apply for membership now, so the
 * account it would overwrite could belong to an admin — who would be locked out
 * of the panel by an admin action meant to help them.
 */
function makeService(userExists: boolean) {
  const application = {
    id: 'app-1',
    email: 'ada@builders.test',
    fullName: 'Ada Lovelace',
    paymentStatus: 'SUCCESS',
    approvedAt: null,
  };
  const prisma = {
    application: {
      findUnique: jest.fn().mockResolvedValue(application),
      update: jest.fn().mockResolvedValue(application),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(userExists ? { id: 'user-1' } : null),
      upsert: jest.fn().mockResolvedValue({ id: 'user-1', email: application.email, referralCode: 'ABC' }),
    },
    passwordResetToken: { create: jest.fn().mockResolvedValue({}) },
    // Reached only on the happy path, where approval also provisions the member.
    globalSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const mail = { sendInvitation: jest.fn().mockResolvedValue(undefined), frontendBaseUrl: () => 'https://buildersnode.com' };
  const prosperaSub = { provisionMember: jest.fn().mockResolvedValue({ status: 'SKIPPED', externalMemberId: null, subscriptions: [] }) };
  return { service: new AdminService(prisma as never, prosperaSub as never, mail as never, {} as never), prisma };
}

describe('AdminService.sendCredentials', () => {
  it('refuses when the applicant already has an account', async () => {
    const { service, prisma } = makeService(true);
    await expect(service.sendCredentials('app-1')).rejects.toThrow(/already has an account/);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('names the action to use instead', async () => {
    const { service } = makeService(true);
    await expect(service.sendCredentials('app-1')).rejects.toThrow(/Complete onboarding/);
  });

  it('still works for an applicant with no login', async () => {
    const { service, prisma } = makeService(false);
    await service.sendCredentials('app-1');
    expect(prisma.user.upsert).toHaveBeenCalled();
  });
});
