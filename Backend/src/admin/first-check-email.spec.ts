import { AdminService } from './admin.service';
import { MailService } from '../mail/mail.service';

/**
 * The "book a call" email that goes out when an applicant clears the first
 * check. It reaches a real person, so what's pinned here is when it's sent as
 * much as what's in it.
 */
function makeService(application: Record<string, unknown> = {}) {
  const app = {
    id: 'app-1',
    email: 'robert@innerlife-ai.com',
    fullName: 'Robert Neufeld',
    status: 'SUBMITTED',
    firstApprovedAt: null,
    approvedAt: null,
    ...application,
  };
  const prisma = {
    application: {
      findUnique: jest.fn().mockResolvedValue(app),
      update: jest.fn().mockResolvedValue({ ...app, status: 'FIRST_APPROVED' }),
      // Approval claims the row with a conditional updateMany, so only one of
      // two overlapping requests can send the invitation. `count` is what the
      // service keys the email off.
      updateMany: jest.fn().mockResolvedValue({ count: app.firstApprovedAt ? 0 : 1 }),
    },
  };
  const mail = { sendFirstCheckApproved: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new AdminService(prisma as never, {} as never, mail as never, {} as never),
    prisma,
    mail,
  };
}

describe('AdminService.firstCheck — applicant email', () => {
  it('emails the applicant when the first check is approved', async () => {
    const { service, mail } = makeService();
    await service.firstCheck('app-1', true);
    expect(mail.sendFirstCheckApproved).toHaveBeenCalledWith('robert@innerlife-ai.com', 'Robert Neufeld');
  });

  it('sends nothing when the applicant is rejected', async () => {
    const { service, mail } = makeService();
    await service.firstCheck('app-1', false);
    expect(mail.sendFirstCheckApproved).not.toHaveBeenCalled();
  });

  it('does not email twice if the check is approved again', async () => {
    // A double click, or a bulk approve run over a selection that already
    // includes approved applicants.
    const { service, mail } = makeService({ firstApprovedAt: new Date('2026-08-01') });
    await service.firstCheck('app-1', true);
    expect(mail.sendFirstCheckApproved).not.toHaveBeenCalled();
  });

  it('still records the approval even so', async () => {
    const { service, prisma } = makeService();
    await service.firstCheck('app-1', true);
    // Written with the "not approved yet" condition in the WHERE, so two
    // overlapping requests can't both decide they were the first.
    expect(prisma.application.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firstApprovedAt: null }),
        data: expect.objectContaining({ status: 'FIRST_APPROVED' }),
      }),
    );
  });

  it('sends nothing when another request already claimed the approval', async () => {
    // The race the condition exists for: the row moved between our read and
    // our write, so this request is the loser and must stay quiet.
    const { service, prisma, mail } = makeService();
    prisma.application.updateMany.mockResolvedValue({ count: 0 });

    await service.firstCheck('app-1', true);

    expect(mail.sendFirstCheckApproved).not.toHaveBeenCalled();
  });
});

/** The rendered message — greeting, calendar link, and no broken markup. */
describe('MailService.sendFirstCheckApproved', () => {
  function makeMail(env: Record<string, string> = {}) {
    const config = { get: (key: string) => env[key] };
    const mail = new MailService(config as never);
    const sent: Array<{ to: string; subject: string; html: string; text: string }> = [];
    jest.spyOn(mail, 'send').mockImplementation(async (email) => {
      sent.push(email as (typeof sent)[number]);
    });
    return { mail, sent };
  }

  it('greets by first name only', async () => {
    const { mail, sent } = makeMail();
    await mail.sendFirstCheckApproved('a@b.test', 'Robert Neufeld');
    expect(sent[0].text).toContain('Hi Robert,');
    expect(sent[0].text).not.toContain('Hi Robert Neufeld');
  });

  it('falls back to a greeting that still reads when there is no name', async () => {
    const { mail, sent } = makeMail();
    await mail.sendFirstCheckApproved('a@b.test', '   ');
    expect(sent[0].text).toContain('Hi there,');
  });

  it('includes the booking calendar in both the text and HTML parts', async () => {
    const { mail, sent } = makeMail();
    await mail.sendFirstCheckApproved('a@b.test', 'Ada');
    expect(sent[0].text).toContain('calendar.google.com/calendar/u/0/appointments/schedules/');
    expect(sent[0].html).toContain('calendar.google.com/calendar/u/0/appointments/schedules/');
  });

  it('uses MEETING_BOOKING_URL when it is configured', async () => {
    const { mail, sent } = makeMail({ MEETING_BOOKING_URL: 'https://cal.example/builders' });
    await mail.sendFirstCheckApproved('a@b.test', 'Ada');
    expect(sent[0].text).toContain('https://cal.example/builders');
    expect(sent[0].html).toContain('https://cal.example/builders');
  });

  it('escapes the name, which comes from a public form', async () => {
    const { mail, sent } = makeMail();
    await mail.sendFirstCheckApproved('a@b.test', '<script>alert(1)</script>');
    expect(sent[0].html).not.toContain('<script>');
    expect(sent[0].html).toContain('&lt;script&gt;');
  });
});
