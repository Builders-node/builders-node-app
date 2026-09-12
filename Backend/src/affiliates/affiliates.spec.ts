import { AffiliatesService } from './affiliates.service';

/**
 * The affiliate programme.
 *
 * What's pinned here is the handful of rules that decide whether an affiliate
 * link works and whether the wrong person gets paid: an approved affiliate must
 * end up owning a referral code, somebody who already has a login must keep the
 * password they chose, and a decision once made must not be quietly undone by
 * the applicant resubmitting the form.
 */
function makeService(
  options: {
    application?: Record<string, unknown> | null;
    existingUser?: Record<string, unknown> | null;
    campaignLink?: Record<string, unknown> | null;
  } = {},
) {
  const {
    application = { id: 'aff-1', email: 'nina@example.com', fullName: 'Nina Alvarez', status: 'PENDING', telegram: '@nina', adminNote: null },
    existingUser = null,
    campaignLink = null,
  } = options;

  const prisma = {
    affiliateApplication: {
      findUnique: jest.fn().mockResolvedValue(application),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'aff-new', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...application, ...data })),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(existingUser),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'user-new', referralCode: data.referralCode })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'user-old', referralCode: data.referralCode })),
    },
    application: { groupBy: jest.fn().mockResolvedValue([]) },
    campaignLink: { findUnique: jest.fn().mockResolvedValue(campaignLink) },
    passwordResetToken: { create: jest.fn().mockResolvedValue({}) },
    globalSetting: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  const mail = {
    frontendBaseUrl: jest.fn().mockReturnValue('https://buildersnode.com'),
    sendAffiliateApplicationReceived: jest.fn().mockResolvedValue(undefined),
    sendAffiliateApplicationAlert: jest.fn().mockResolvedValue(undefined),
    sendAffiliateApproved: jest.fn().mockResolvedValue(undefined),
    sendAffiliateDeclined: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = { notifyAdmins: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new AffiliatesService(prisma as never, mail as never, notifications as never),
    prisma,
    mail,
  };
}

describe('AffiliatesService.apply', () => {
  it('stores a first-time application and tells the applicant it landed', async () => {
    const { service, prisma, mail } = makeService({ application: null });

    const result = await service.apply({ fullName: 'Nina Alvarez', email: 'Nina@Example.com ' });

    expect(result).toEqual({ submitted: true, email: 'nina@example.com' });
    // Addresses are matched, mailed and deduplicated by this value — a stray
    // capital would make the same person two applicants.
    expect(prisma.affiliateApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'nina@example.com', status: 'PENDING' }) }),
    );
    expect(mail.sendAffiliateApplicationReceived).toHaveBeenCalledWith('nina@example.com', 'Nina Alvarez');
  });

  it('lets a pending applicant resubmit rather than hitting a wall', async () => {
    // People do come back having remembered a channel they forgot to list.
    const { service, prisma } = makeService();

    await service.apply({ fullName: 'Nina Alvarez', email: 'nina@example.com', audience: 'YouTube, 40k' });

    expect(prisma.affiliateApplication.update).toHaveBeenCalled();
    expect(prisma.affiliateApplication.create).not.toHaveBeenCalled();
  });

  it('refuses to reopen an application that was already decided', async () => {
    const { service } = makeService({ application: { id: 'aff-1', email: 'nina@example.com', status: 'DECLINED' } });

    await expect(service.apply({ fullName: 'Nina Alvarez', email: 'nina@example.com' })).rejects.toThrow();
  });

  it('ignores a campaign code no admin ever created', async () => {
    // `?src=` sits in a URL anyone can edit; an unchecked value would invent
    // rows in the traffic report.
    const { service, prisma } = makeService({ application: null, campaignLink: null });

    await service.apply({ fullName: 'Nina Alvarez', email: 'nina@example.com', campaignCode: 'made-up' });

    expect(prisma.affiliateApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ campaignCode: null }) }),
    );
  });

  it('keeps only real URLs, and every channel rather than the first', async () => {
    const { service, prisma } = makeService({ application: null });

    await service.apply({
      fullName: 'Nina Alvarez',
      email: 'nina@example.com',
      links: ['https://youtube.com/@nina', 'not a url', 'https://instagram.com/nina'],
    });

    const { data } = prisma.affiliateApplication.create.mock.calls[0][0];
    expect(JSON.parse(data.linksJson)).toEqual(['https://youtube.com/@nina', 'https://instagram.com/nina']);
  });
});

describe('AffiliatesService.approve', () => {
  it('gives a new affiliate the account their referral code hangs off', async () => {
    // Referral credit is resolved through User.referralCode, so without this
    // an approved affiliate has nothing to share.
    const { service, prisma, mail } = makeService();

    await service.approve('aff-1');

    expect(prisma.user.create).toHaveBeenCalled();
    const approval = mail.sendAffiliateApproved.mock.calls[0][2];
    expect(approval.inviteLink).toMatch(/^https:\/\/buildersnode\.com\/\?ref=BUILDERS-/);
    // Nobody set this number in the test, so it is the launch default.
    expect(approval.rewardCents).toBe(20_000);
    // The account was made just now, so the credentials to reach it go too.
    expect(approval.temporaryPassword).toBeTruthy();
  });

  it('never resets the password of somebody who already has a login', async () => {
    // Members and admins apply too. Minting a temporary password over their
    // account would lock them out of the one they actually use.
    const { service, prisma, mail } = makeService({
      existingUser: { id: 'user-old', referralCode: 'BUILDERS-OLD123' },
    });

    await service.approve('aff-1');

    expect(prisma.user.create).not.toHaveBeenCalled();
    const approval = mail.sendAffiliateApproved.mock.calls[0][2];
    expect(approval.referralCode).toBe('BUILDERS-OLD123');
    expect(approval.temporaryPassword).toBeUndefined();
  });

  it('mints a code for an old account that never had one', async () => {
    // An affiliate link reading ?ref=null is worse than no link at all.
    const { service, prisma, mail } = makeService({ existingUser: { id: 'user-old', referralCode: null } });

    await service.approve('aff-1');

    expect(prisma.user.update).toHaveBeenCalled();
    expect(mail.sendAffiliateApproved.mock.calls[0][2].referralCode).toMatch(/^BUILDERS-/);
  });

  it('refuses a second approval instead of re-issuing credentials', async () => {
    const { service } = makeService({ application: { id: 'aff-1', email: 'nina@example.com', status: 'APPROVED' } });

    await expect(service.approve('aff-1')).rejects.toThrow();
  });
});

describe('AffiliatesService.list', () => {
  it('counts the people each affiliate actually sent', async () => {
    const { service, prisma } = makeService();
    prisma.affiliateApplication.findMany.mockResolvedValue([
      { id: 'aff-1', fullName: 'Nina Alvarez', email: 'nina@example.com', status: 'APPROVED', userId: 'user-1', linksJson: null, createdAt: new Date() },
    ]);
    prisma.application.groupBy.mockResolvedValue([{ referredByUserId: 'user-1', _count: { _all: 3 } }]);
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', referralCode: 'BUILDERS-AB12CD' }]);

    const [nina] = await service.list();

    expect(nina.referredCount).toBe(3);
    expect(nina.inviteLink).toBe('https://buildersnode.com/?ref=BUILDERS-AB12CD');
  });

  it('offers no link for someone still pending', async () => {
    const { service, prisma } = makeService();
    prisma.affiliateApplication.findMany.mockResolvedValue([
      { id: 'aff-2', fullName: 'Sam Reed', email: 'sam@example.com', status: 'PENDING', userId: null, linksJson: null, createdAt: new Date() },
    ]);

    const [sam] = await service.list();

    expect(sam.inviteLink).toBeNull();
    expect(sam.referredCount).toBe(0);
  });
});
