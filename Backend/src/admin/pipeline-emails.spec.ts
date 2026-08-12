import { AdminService } from './admin.service';
import { MailService } from '../mail/mail.service';

/**
 * The three later pipeline emails: meeting approved, payment confirmed, and
 * membership activated.
 *
 * Every one of these reaches a real applicant, and every one sits behind an
 * admin button that is safe to press twice — so what's pinned here is mostly
 * *when* they go out. A duplicate "welcome to Builders Node" is worse than none.
 */
function makeService(application: Record<string, unknown> = {}) {
  const app = {
    id: 'app-1',
    email: 'robert@innerlife-ai.com',
    fullName: 'Robert Neufeld',
    status: 'FIRST_APPROVED',
    apartmentAvailable: true,
    meetingApprovedAt: null,
    paymentConfirmedAt: null,
    paymentStatus: null,
    approvedAt: null,
    ...application,
  };
  const prisma = {
    application: {
      findUnique: jest.fn().mockResolvedValue(app),
      update: jest.fn().mockResolvedValue(app),
      // Both firstCheck and activateMembership claim the row conditionally now
      // and send their email only when they were the request that moved it.
      updateMany: jest.fn().mockResolvedValue({ count: app.status === 'CREDENTIALS_SENT' ? 0 : 1 }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    membership: {
      // Read before the upsert so an already-active member keeps their billing
      // anchor — activation no longer resets dueDate on a re-run.
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const mail = {
    sendMeetingApproved: jest.fn().mockResolvedValue(undefined),
    sendPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
    sendMembershipActivated: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new AdminService(prisma as never, {} as never, mail as never, notifications as never),
    prisma,
    mail,
  };
}

describe('AdminService.onlineMeetingCheck — applicant email', () => {
  it('thanks the applicant for the call when the meeting is approved', async () => {
    const { service, mail } = makeService();
    await service.onlineMeetingCheck('app-1', true);
    expect(mail.sendMeetingApproved).toHaveBeenCalledWith('robert@innerlife-ai.com', 'Robert Neufeld');
  });

  it('sends nothing when the meeting is rejected', async () => {
    const { service, mail } = makeService();
    await service.onlineMeetingCheck('app-1', false);
    expect(mail.sendMeetingApproved).not.toHaveBeenCalled();
  });

  it('does not email twice if the meeting is approved again', async () => {
    const { service, mail } = makeService({ meetingApprovedAt: new Date('2026-08-01') });
    await service.onlineMeetingCheck('app-1', true);
    expect(mail.sendMeetingApproved).not.toHaveBeenCalled();
  });
});

describe('AdminService.confirmPayment — applicant email', () => {
  it('sends a receipt the first time payment is confirmed', async () => {
    const { service, mail } = makeService({ status: 'PAYMENT_LINK_SENT', paymentStatus: 'PENDING' });
    await service.confirmPayment('app-1');
    expect(mail.sendPaymentConfirmed).toHaveBeenCalledWith('robert@innerlife-ai.com', 'Robert Neufeld');
  });

  it('does not send a second receipt for the same payment', async () => {
    const { service, mail } = makeService({
      status: 'PAYMENT_LINK_SENT',
      paymentStatus: 'PENDING',
      paymentConfirmedAt: new Date('2026-08-01'),
    });
    await service.confirmPayment('app-1');
    expect(mail.sendPaymentConfirmed).not.toHaveBeenCalled();
  });
});

describe('AdminService.activateMembership — applicant email', () => {
  it('welcomes the new member once their membership goes live', async () => {
    const { service, mail } = makeService({ status: 'PAYMENT_CONFIRMED', paymentStatus: 'SUCCESS' });
    await service.activateMembership('app-1');
    expect(mail.sendMembershipActivated).toHaveBeenCalledWith('robert@innerlife-ai.com', 'Robert Neufeld');
  });

  it('stays quiet when the application is already onboarded', async () => {
    // activateMembership is deliberately idempotent, so re-running it must not
    // welcome the same member a second time.
    const { service, mail } = makeService({ status: 'CREDENTIALS_SENT', paymentStatus: 'SUCCESS' });
    await service.activateMembership('app-1');
    expect(mail.sendMembershipActivated).not.toHaveBeenCalled();
  });
});

describe('the rendered pipeline emails', () => {
  function makeMail(env: Record<string, string> = {}) {
    const config = { get: (key: string) => env[key] };
    const mail = new MailService(config as never);
    const sent: Array<{ to: string; subject: string; html: string; text: string }> = [];
    jest.spyOn(mail, 'send').mockImplementation(async (email) => {
      sent.push(email as (typeof sent)[number]);
    });
    return { mail, sent };
  }

  it('greets by first name in all three', async () => {
    const { mail, sent } = makeMail();
    await mail.sendMeetingApproved('a@b.test', 'Robert Neufeld');
    await mail.sendPaymentConfirmed('a@b.test', 'Robert Neufeld');
    await mail.sendMembershipActivated('a@b.test', 'Robert Neufeld');
    for (const email of sent) {
      expect(email.text).toContain('Hi Robert,');
      expect(email.text).not.toContain('Hi Robert Neufeld');
    }
  });

  it('points the welcome email at the dashboard', async () => {
    const { mail, sent } = makeMail({ FRONTEND_URL: 'https://buildersnode.com' });
    await mail.sendMembershipActivated('a@b.test', 'Ada');
    expect(sent[0].text).toContain('https://buildersnode.com/home');
    expect(sent[0].html).toContain('https://buildersnode.com/home');
  });

  it('escapes the name, which comes from a public form', async () => {
    const { mail, sent } = makeMail();
    await mail.sendMeetingApproved('a@b.test', '<script>alert(1)</script>');
    expect(sent[0].html).not.toContain('<script>');
    expect(sent[0].html).toContain('&lt;script&gt;');
  });
});
