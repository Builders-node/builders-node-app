import { NudgesService } from './nudges.service';

/**
 * The automatic follow-ups. What is pinned is restraint: when each one may go,
 * that it goes at most as often as promised, that a failed send can be tried
 * again tomorrow, and that nobody already past the step is nudged about it.
 */
const NOW = new Date('2026-10-10T16:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

function makeService(rows: {
  applications?: Array<Record<string, unknown>>;
  verifications?: Array<Record<string, unknown>>;
  guides?: Array<Record<string, unknown>>;
  appliedEmails?: string[];
  admins?: string[];
  sendOk?: boolean;
} = {}) {
  const ok = rows.sendOk ?? true;
  const prisma = {
    application: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        if (where?.email?.in) return Promise.resolve((rows.appliedEmails ?? []).map((email) => ({ email })));
        return Promise.resolve((rows.applications ?? []).filter((app) => {
          const status = where?.status;
          if (typeof status === 'string') return app.status === status;
          if (status?.in) return status.in.includes(app.status);
          return true;
        }));
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    applicationVerification: {
      findMany: jest.fn().mockResolvedValue(rows.verifications ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    guideRequest: {
      findMany: jest.fn().mockResolvedValue(rows.guides ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findMany: jest.fn().mockResolvedValue((rows.admins ?? []).map((email) => ({ email }))) },
  };
  const mail = {
    sendMeetingReminder: jest.fn().mockResolvedValue(ok),
    sendPaymentReminder: jest.fn().mockResolvedValue(ok),
    sendApplicationUnfinished: jest.fn().mockResolvedValue(ok),
    sendGuideFollowUp: jest.fn().mockResolvedValue(ok),
    sendStaleApplicantsDigest: jest.fn().mockResolvedValue(ok),
    frontendBaseUrl: () => 'https://buildersnode.com',
  };
  return { service: new NudgesService(prisma as never, mail as never), prisma, mail };
}

const run = (service: NudgesService) => service.runDaily(NOW, Date.now() + 60_000);

describe('NudgesService — booking reminders', () => {
  const approved = (days: number, extra: Record<string, unknown> = {}) => ({
    id: 'a1', email: 'ada@x.test', fullName: 'Ada', status: 'FIRST_APPROVED',
    firstApprovedAt: daysAgo(days), autoMeetingReminders: 0, meetingReminderSentAt: null, ...extra,
  });

  it('waits three days before the first one', async () => {
    const early = makeService({ applications: [approved(2)] });
    await run(early.service);
    expect(early.mail.sendMeetingReminder).not.toHaveBeenCalled();

    const due = makeService({ applications: [approved(3)] });
    await run(due.service);
    expect(due.mail.sendMeetingReminder).toHaveBeenCalledWith('ada@x.test', 'Ada');
  });

  it('sends the second only from day seven', async () => {
    const { service, mail } = makeService({ applications: [approved(5, { autoMeetingReminders: 1, meetingReminderSentAt: daysAgo(2) })] });
    await run(service);
    expect(mail.sendMeetingReminder).not.toHaveBeenCalled();
  });

  it('stays quiet right after an admin pressed Remind', async () => {
    const { service, mail } = makeService({ applications: [approved(4, { meetingReminderSentAt: daysAgo(1) })] });
    await run(service);
    expect(mail.sendMeetingReminder).not.toHaveBeenCalled();
  });

  it('gives the claim back when the email fails, so tomorrow tries again', async () => {
    const { service, prisma } = makeService({ applications: [approved(3)], sendOk: false });
    await run(service);
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { autoMeetingReminders: 0, meetingReminderSentAt: null } }),
    );
  });
});

describe('NudgesService — payment reminders', () => {
  const linkSent = (days: number, reminder: Date | null) => ({
    id: 'a1', email: 'ada@x.test', fullName: 'Ada', status: 'PAYMENT_LINK_SENT', paymentLink: 'https://pay.test/x',
    paymentAmountCents: 195000, paymentCurrency: 'USD', paymentLinkSentAt: daysAgo(days), paymentReminderSentAt: reminder,
  });

  it('reminds on day two, with the amount', async () => {
    const { service, mail } = makeService({ applications: [linkSent(2, null)] });
    await run(service);
    expect(mail.sendPaymentReminder).toHaveBeenCalledWith('ada@x.test', 'Ada', 'https://pay.test/x', { cents: 195000, currency: 'USD' });
  });

  it('reminds a second time three days after the first, and never a third', async () => {
    const second = makeService({ applications: [linkSent(5, daysAgo(3))] });
    await run(second.service);
    expect(second.mail.sendPaymentReminder).toHaveBeenCalled();

    const third = makeService({ applications: [linkSent(9, daysAgo(3.5))] });
    await run(third.service);
    expect(third.mail.sendPaymentReminder).not.toHaveBeenCalled();
  });
});

describe('NudgesService — unfinished applications', () => {
  it('sends one email with a fresh code that lasts two days', async () => {
    const { service, prisma, mail } = makeService({
      verifications: [{ id: 'v1', email: 'ada@x.test', payloadJson: JSON.stringify({ fullName: 'Ada Lovelace' }) }],
    });
    await run(service);
    const claim = prisma.applicationVerification.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({ id: 'v1', reminderSentAt: null });
    expect(claim.data.expiresAt.getTime() - NOW.getTime()).toBe(2 * 24 * 60 * 60 * 1000);
    expect(mail.sendApplicationUnfinished).toHaveBeenCalledWith('ada@x.test', 'Ada Lovelace', claim.data.code);
  });
});

describe('NudgesService — guide follow-ups', () => {
  const lead = (days: number, followUpCount = 0) => ({
    id: 'g1', email: 'sam@x.test', name: 'Sam', accessKey: 'BN-AAAA-BBBB', source: 'ca', sentAt: daysAgo(days), followUpCount,
  });

  it('sends the first on day two, linking the guide on the site they asked on', async () => {
    const { service, mail } = makeService({ guides: [lead(2)] });
    await run(service);
    const [, , step, links] = mail.sendGuideFollowUp.mock.calls[0];
    expect(step).toBe(1);
    expect(links.guideUrl).toContain('ca.buildersnode.com/guide?key=BN-AAAA-BBBB');
  });

  it('stops once the reader has applied', async () => {
    const { service, mail } = makeService({ guides: [lead(6, 1)], appliedEmails: ['sam@x.test'] });
    await run(service);
    expect(mail.sendGuideFollowUp).not.toHaveBeenCalled();
  });
});

describe('NudgesService — stale applicants digest', () => {
  it('lists only applicants waiting on us for more than five days', async () => {
    const { service, mail } = makeService({
      admins: ['owner@x.test'],
      applications: [
        { fullName: 'Old', email: 'old@x.test', status: 'SUBMITTED', createdAt: daysAgo(9) },
        { fullName: 'New', email: 'new@x.test', status: 'SUBMITTED', createdAt: daysAgo(2) },
      ],
    });
    await run(service);
    const [, rows] = mail.sendStaleApplicantsDigest.mock.calls[0];
    expect(rows.map((row: { email: string }) => row.email)).toEqual(['old@x.test']);
  });
});
