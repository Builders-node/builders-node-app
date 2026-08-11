import { AdminService } from './admin.service';

/**
 * The "Remind" button on an applicant waiting to book their intro call.
 *
 * It sends a real email to a real person from a single click, so the guards
 * matter more than the happy path: wrong stage, twice in a row, and a mail
 * failure that would otherwise leave the card claiming it went out.
 */
const BOOKING_URL = 'https://calendar.google.com/appointments/test';

function makeService(application: Record<string, unknown> = {}) {
  const app = {
    id: 'app-1',
    email: 'ada@builders.test',
    fullName: 'Ada Lovelace',
    status: 'FIRST_APPROVED',
    meetingReminderSentAt: null,
    ...application,
  };
  const prisma = {
    application: {
      findUnique: jest.fn().mockResolvedValue(app),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...app, ...data })),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
  };
  const mail = {
    sendMeetingReminder: jest.fn().mockResolvedValue(undefined),
    meetingBookingUrl: jest.fn().mockReturnValue(BOOKING_URL),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminService(prisma as never, {} as never, mail as never, notifications as never);
  return { service, prisma, mail, notifications, app };
}

describe('AdminService.remindMeeting', () => {
  it('emails the applicant and records when it went out', async () => {
    const { service, prisma, mail } = makeService();

    await service.remindMeeting('app-1');

    expect(mail.sendMeetingReminder).toHaveBeenCalledWith('ada@builders.test', 'Ada Lovelace');
    const stamped = prisma.application.update.mock.calls[0][0].data.meetingReminderSentAt as Date;
    expect(stamped).toBeInstanceOf(Date);
  });

  it('also notifies them in-app, because applicants have accounts now', async () => {
    const { service, notifications } = makeService();

    await service.remindMeeting('app-1');

    expect(notifications.notify).toHaveBeenCalledWith('user-1', expect.objectContaining({ title: expect.any(String) }));
  });

  it('puts the booking URL in the body, never in `link`', async () => {
    // The notification bell resolves `link` as an in-app path, so an external
    // calendar URL there would quietly send them to /profile instead.
    const { service, notifications } = makeService();

    await service.remindMeeting('app-1');

    const sent = notifications.notify.mock.calls[0][1] as { body: string; link?: string };
    expect(sent.body).toContain(BOOKING_URL);
    expect(sent.link).toBeUndefined();
  });

  it('still sends the email when the applicant has no account yet', async () => {
    const { service, prisma, mail, notifications } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);

    await service.remindMeeting('app-1');

    expect(mail.sendMeetingReminder).toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('refuses at any stage other than waiting-to-book', async () => {
    // Someone past the call has no calendar to open, and someone rejected
    // should not be invited back.
    for (const status of ['SUBMITTED', 'FIRST_REJECTED', 'MEETING_APPROVED', 'PAYMENT_CONFIRMED']) {
      const { service, mail } = makeService({ status });
      await expect(service.remindMeeting('app-1')).rejects.toThrow(/waiting to book/i);
      expect(mail.sendMeetingReminder).not.toHaveBeenCalled();
    }
  });

  it('refuses a second reminder the same day — the double-click guard', async () => {
    const { service, mail } = makeService({ meetingReminderSentAt: new Date(Date.now() - 60 * 60 * 1000) });

    await expect(service.remindMeeting('app-1')).rejects.toThrow(/already went out today/i);
    expect(mail.sendMeetingReminder).not.toHaveBeenCalled();
  });

  it('allows another reminder once a day has passed', async () => {
    const { service, mail } = makeService({ meetingReminderSentAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });

    await service.remindMeeting('app-1');

    expect(mail.sendMeetingReminder).toHaveBeenCalled();
  });

  it('does not stamp the application when the email fails', async () => {
    // Otherwise the card reads "Last reminded today" for a message nobody got,
    // and the 24-hour guard blocks the retry.
    const { service, prisma, mail } = makeService();
    mail.sendMeetingReminder.mockRejectedValue(new Error('resend is down'));

    await expect(service.remindMeeting('app-1')).rejects.toThrow('resend is down');
    expect(prisma.application.update).not.toHaveBeenCalled();
  });
});
