import { ConfigService } from '@nestjs/config';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService referrals', () => {
  it('stores the referral code and referrer when an applicant applies with a member code', async () => {
    const referrer = { id: 'referrer-1', referralCode: 'BUILDERS-AB12CD' };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(referrer),
      },
      application: {
        create: jest.fn().mockResolvedValue({
          id: 'application-1',
          email: 'new@terminus.test',
          referralCode: referrer.referralCode,
          referredByUserId: referrer.id,
        }),
      },
    };
    const service = new ApplicationsService(prisma as never, new ConfigService(), {} as never, {} as never, { notify: async () => {}, notifyAdmins: async () => {} } as never);

    await service.apply({
      fullName: 'New Member',
      email: 'new@terminus.test',
      referralCode: ' builders-ab12cd ',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { referralCode: 'BUILDERS-AB12CD' },
      select: { id: true, referralCode: true },
    });
    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referralCode: 'BUILDERS-AB12CD',
          referredByUserId: referrer.id,
        }),
      }),
    );
  });
});
