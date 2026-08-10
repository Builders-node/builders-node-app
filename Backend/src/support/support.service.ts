import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_BODY = 4000;

/**
 * Member-side support.
 *
 * The endpoints existed from the start and no screen ever called them, so the
 * admin queue could never receive anything and a member with a problem had no
 * channel at all. It's a conversation now rather than a message into the void:
 * an admin reply is a message the member can read and answer.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createTicket(userId: string, data: { subject?: string; message?: string }) {
    const subject = clean(data.subject, 'A subject helps us route this to the right person.');
    const message = clean(data.message, 'Tell us what you need — a sentence is fine.');

    const ticket = await this.prisma.supportTicket.create({
      data: { userId, subject, message, status: 'OPEN' },
    });

    await this.notifications.notifyAdmins({
      type: 'info',
      title: 'New support ticket',
      body: subject,
      link: '/admin/inbox/support',
    });

    return this.detail(ticket.id, userId);
  }

  async listTickets(userId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return tickets.map(shape);
  }

  /** Add the member's own reply. Reopens a ticket that had been resolved. */
  async reply(userId: string, ticketId: string, body?: string) {
    const message = clean(body, "Write something first — an empty reply doesn't tell us anything.");
    const ticket = await this.requireOwned(ticketId, userId);

    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId, author: 'MEMBER', body: message } }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data:
          ticket.status === 'RESOLVED'
            ? // Answering a closed ticket reopens it, otherwise the reply lands
              // in a queue nobody is looking at.
              { status: 'OPEN', resolvedAt: null, updatedAt: new Date() }
            : { updatedAt: new Date() },
      }),
    ]);

    await this.notifications.notifyAdmins({
      type: 'info',
      title: 'Support reply',
      body: `${ticket.subject} — the member replied.`,
      link: '/admin/inbox/support',
    });

    return this.detail(ticketId, userId);
  }

  private async detail(ticketId: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket || ticket.userId !== userId) throw new NotFoundException('Ticket not found.');
    return shape(ticket);
  }

  /** A member may only ever touch their own ticket. */
  private async requireOwned(ticketId: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (ticket.userId !== userId) throw new ForbiddenException('That ticket belongs to someone else.');
    return ticket;
  }
}

/**
 * The shape the member sees. `adminNote` is deliberately absent: it's the
 * admin's internal scratchpad, not part of the conversation.
 */
function shape(ticket: {
  id: string;
  subject: string;
  message: string;
  status: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{ id: string; author: string; body: string; createdAt: Date }>;
}) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    resolvedAt: ticket.resolvedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    // The opening message is part of the thread as far as reading goes, so it
    // is served as one rather than as a separate field the UI has to special-case.
    messages: [
      { id: `${ticket.id}-opening`, author: 'MEMBER', body: ticket.message, createdAt: ticket.createdAt },
      ...ticket.messages,
    ],
  };
}

function clean(value: string | undefined, blankMessage: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new BadRequestException(blankMessage);
  return trimmed.slice(0, MAX_BODY);
}
