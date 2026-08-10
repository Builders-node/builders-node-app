import { SupportService } from './support.service';

/**
 * Support, both directions.
 *
 * The thing worth pinning hardest is ownership: a ticket id is guessable enough
 * that "reply to any ticket" would be a way to read and write into someone
 * else's conversation with us.
 */
function makeService(ticket: Record<string, unknown> | null = {}) {
  const row = ticket && {
    id: 'ticket-1',
    userId: 'user-1',
    subject: 'Wi-Fi in 602',
    message: 'It drops every evening.',
    status: 'OPEN',
    resolvedAt: null,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    messages: [],
    ...ticket,
  };
  const prisma = {
    supportTicket: {
      create: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue(row ? [row] : []),
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockReturnValue('update-op'),
    },
    supportMessage: { create: jest.fn().mockReturnValue('create-op') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined), notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  return { service: new SupportService(prisma as never, notifications as never), prisma, notifications };
}

describe('SupportService.createTicket', () => {
  it('files the ticket and puts it in front of the admins', async () => {
    const { service, prisma, notifications } = makeService();
    await service.createTicket('user-1', { subject: 'Wi-Fi in 602', message: 'It drops every evening.' });
    expect(prisma.supportTicket.create).toHaveBeenCalled();
    expect(notifications.notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ link: '/admin/inbox/support' }));
  });

  it('refuses an empty subject or message', async () => {
    const { service } = makeService();
    await expect(service.createTicket('user-1', { subject: '   ', message: 'x' })).rejects.toThrow(/subject/i);
    await expect(service.createTicket('user-1', { subject: 'x', message: '  ' })).rejects.toThrow(/Tell us/i);
  });
});

describe('SupportService.listTickets', () => {
  it('serves the opening message as the first message in the thread', async () => {
    // Otherwise every screen has to special-case "the first one lives in a
    // different field".
    const { service } = makeService({ messages: [{ id: 'm1', author: 'ADMIN', body: 'Looking into it.', createdAt: new Date() }] });
    const [ticket] = await service.listTickets('user-1');
    expect(ticket.messages.map((m) => m.body)).toEqual(['It drops every evening.', 'Looking into it.']);
    expect(ticket.messages[0].author).toBe('MEMBER');
  });

  it('never exposes the internal admin note', async () => {
    const { service } = makeService({ adminNote: 'chase the ISP' });
    const [ticket] = await service.listTickets('user-1');
    expect(JSON.stringify(ticket)).not.toContain('chase the ISP');
  });
});

describe('SupportService.reply', () => {
  it('adds the message and tells the admins', async () => {
    const { service, prisma, notifications } = makeService();
    await service.reply('user-1', 'ticket-1', 'Still happening.');
    expect(prisma.supportMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', author: 'MEMBER', body: 'Still happening.' },
    });
    expect(notifications.notifyAdmins).toHaveBeenCalled();
  });

  it('reopens a resolved ticket rather than burying the reply', async () => {
    const { service, prisma } = makeService({ status: 'RESOLVED', resolvedAt: new Date() });
    await service.reply('user-1', 'ticket-1', 'It came back.');
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'OPEN', resolvedAt: null }) }),
    );
  });

  it("refuses to touch someone else's ticket", async () => {
    const { service, prisma } = makeService({ userId: 'someone-else' });
    await expect(service.reply('user-1', 'ticket-1', 'hello')).rejects.toThrow(/belongs to someone else/);
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
  });

  it('refuses an empty reply', async () => {
    const { service } = makeService();
    await expect(service.reply('user-1', 'ticket-1', '   ')).rejects.toThrow(/Write something/);
  });

  it('404s on a ticket that does not exist', async () => {
    const { service } = makeService(null);
    await expect(service.reply('user-1', 'nope', 'hello')).rejects.toThrow(/not found/i);
  });
});
