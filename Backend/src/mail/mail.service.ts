import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InvitationEmail } from '../auth/invitation';
import { resolveFrontendBaseUrl } from '../common/frontend-url';

type Email = { to: string; subject: string; html: string; text: string };

/** The parts of an invoice an email needs to state it plainly. */
export type InvoiceEmail = {
  description: string;
  amountCents: number;
  currency: string;
  dueDate: Date;
  payUrl?: string | null;
};

/** Builders Node's Google appointment schedule; override with MEETING_BOOKING_URL. */
const DEFAULT_MEETING_BOOKING_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2-5XDVVLfQfx0r_nqtDttfQV00lCZcIvMg-0B-RG7XYnTALuq2_XY2Q55U8s4J6UdeZjPHbIp9';

/**
 * Transactional email.
 *
 * Uses Resend's HTTP API (no SDK dependency — just fetch). When RESEND_API_KEY
 * is not configured the message is logged instead of sent, so local dev and any
 * deploy without email configured keeps working (the flow is a no-op, never an
 * error). Set RESEND_API_KEY + MAIL_FROM in production to actually deliver mail.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    const key = this.config.get<string>('RESEND_API_KEY');
    return key && key.trim() !== '' ? key : undefined;
  }

  private get from(): string {
    return this.config.get<string>('MAIL_FROM') ?? 'Builders Node <onboarding@resend.dev>';
  }

  /**
   * The public frontend base URL for links in outbound emails. Prefers the
   * custom domain over any *.vercel.app in FRONTEND_URL (comma-separated), so
   * users always click through to the branded domain when it's set.
   */
  frontendBaseUrl(): string {
    return resolveFrontendBaseUrl(this.config.get<string>('FRONTEND_URL'));
  }

  async send(email: Email): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(`RESEND_API_KEY not set — email NOT sent. To: ${email.to} | Subject: ${email.subject}`);
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to: email.to, subject: email.subject, html: email.html, text: email.text }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.error(`Resend responded ${res.status} for ${email.to}: ${detail.slice(0, 200)}`);
      }
    } catch (error) {
      // Never let a mail failure break the surrounding request.
      this.logger.error(`Failed to send email to ${email.to}: ${(error as Error).message}`);
    }
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const url = `${this.frontendBaseUrl()}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: 'Reset your Builders Node password',
      text: `Reset your password using this link (valid 30 minutes):\n${url}\n\nIf you didn't request this, you can ignore this email.`,
      html: layout(
        'Reset your password',
        `<p>We received a request to reset your Builders Node password.</p>
         <p>This link is valid for 30 minutes:</p>
         ${button('Reset password', url)}
         <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>`,
      ),
    });
  }

  async sendEmailVerification(to: string, token: string): Promise<void> {
    const url = `${this.frontendBaseUrl()}/verify-email?token=${token}`;
    await this.send({
      to,
      subject: 'Confirm your email for Builders Node',
      text: `Confirm your email address:\n${url}`,
      html: layout(
        'Confirm your email',
        `<p>Welcome to Builders Node! Please confirm your email address to finish setting up your account.</p>
         ${button('Confirm email', url)}`,
      ),
    });
  }

  async sendApplicationCode(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: `Your Builders Node confirmation code: ${code}`,
      text: `Your Builders Node application confirmation code is ${code}. It expires in 10 minutes. If you didn't apply, you can ignore this email.`,
      html: layout(
        'Confirm your application',
        `<p>Enter this code to confirm your Builders Node application. It expires in 10 minutes.</p>
         <p style="font-size:34px;font-weight:700;letter-spacing:10px;margin:18px 0;color:#111827">${code}</p>
         <p style="color:#6b7280;font-size:13px">If you didn't apply, you can safely ignore this email.</p>`,
      ),
    });
  }

  /**
   * Sent the moment an application is confirmed — the applicant has entered the
   * emailed code and their application row exists.
   *
   * Until now the flow went quiet here: someone filled in a long form, confirmed
   * their email, set a password, and got nothing back. This says we have it and
   * what happens next, so nobody is left wondering whether it went through.
   */
  async sendApplicationReceived(to: string, fullName: string): Promise<void> {
    const name = firstNameOf(fullName);
    await this.send({
      to,
      subject: 'We received your Builders Node application',
      text:
        `Hi ${name},\n\n` +
        "Thanks for applying to Builders Node — we're glad to see your application.\n\n" +
        'Our team reviews every application personally. We will get back to you shortly with the next step.\n\n' +
        "In the meantime there's nothing you need to do.\n\n" +
        'Best regards,\nBuilders Node',
      html: layout(
        'We received your application',
        `<p>Hi ${escapeHtml(name)},</p>
         <p>Thanks for applying to Builders Node — we're glad to see your application.</p>
         <p>Our team reviews every application personally. We will get back to you shortly with the next step.</p>
         <p>In the meantime there's nothing you need to do.</p>
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  /**
   * The payment link, sent to the applicant.
   *
   * This used to be composed by the admin service and handed back to the UI,
   * which showed a "Payment link prepared" toast and dropped it. The button said
   * "Send payment link", the pipeline moved to PAYMENT_LINK_SENT, and the
   * applicant received nothing — they were waiting on a link that never left the
   * building.
   */
  async sendPaymentLink(to: string, fullName: string, paymentUrl: string): Promise<void> {
    const name = firstNameOf(fullName);
    await this.send({
      to,
      subject: 'Your Builders Node payment link',
      text:
        `Hi ${name},\n\n` +
        'Good news — your application has been approved for the next step.\n\n' +
        `To secure your place, complete your payment here: ${paymentUrl}\n\n` +
        "Once it's done we'll confirm your membership and send you everything you need before arrival.\n\n" +
        'Best regards,\nBuilders Node',
      html: layout(
        'Your payment link',
        `<p>Hi ${escapeHtml(name)},</p>
         <p>Good news — your application has been approved for the next step.</p>
         <p>To secure your place, complete your payment here:</p>
         ${button('Complete payment', paymentUrl)}
         <p>Once it's done we'll confirm your membership and send you everything you need before arrival.</p>
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  /**
   * Sent when an applicant clears the first check. Its whole job is to get a
   * call booked, so the calendar link is the only thing to act on.
   *
   * The URL is configurable because a Google appointment schedule can be
   * recreated or moved, and a hardcoded one would silently send applicants to a
   * dead page until somebody redeployed.
   */
  async sendFirstCheckApproved(to: string, fullName: string): Promise<void> {
    const calendarUrl = this.config.get<string>('MEETING_BOOKING_URL') ?? DEFAULT_MEETING_BOOKING_URL;
    const name = firstNameOf(fullName);

    await this.send({
      to,
      subject: 'Next step: book a call with Builders Node',
      text:
        `Hi ${name},\n\n` +
        'Thank you for applying to our community.\n\n' +
        'We were impressed by your background and experience.\n\n' +
        'The next step in our selection process is a short video call so we can get to know each other ' +
        'better and answer any questions you may have.\n\n' +
        `You can book a time that works best for you using the following calendar: ${calendarUrl}\n\n` +
        'We look forward to speaking with you!\n\n' +
        'Best regards,\nBuilders Node',
      html: layout(
        'Thank you for applying',
        `<p>Hi ${escapeHtml(name)},</p>
         <p>Thank you for applying to our community.</p>
         <p>We were impressed by your background and experience.</p>
         <p>The next step in our selection process is a short video call so we can get to know each other better and answer any questions you may have.</p>
         <p>You can book a time that works best for you:</p>
         ${button('Book your call', calendarUrl)}
         <p>We look forward to speaking with you!</p>
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  /**
   * Sent after the video call goes well. Deliberately does not promise a date:
   * the payment link only goes out once an apartment is confirmed available, and
   * that check can take days. This exists so the applicant isn't sitting in that
   * gap wondering how the call went.
   */
  async sendMeetingApproved(to: string, fullName: string): Promise<void> {
    const name = firstNameOf(fullName);
    await this.send({
      to,
      subject: 'Great speaking with you — Builders Node',
      text:
        `Hi ${name},\n\n` +
        'Thank you for taking the time to speak with us — we enjoyed the conversation and would love to have you with us.\n\n' +
        "We're now confirming apartment availability for your dates. As soon as that's done we'll send you a payment link to secure your place.\n\n" +
        "There's nothing you need to do until then.\n\n" +
        'Best regards,\nBuilders Node',
      html: layout(
        'Great speaking with you',
        `<p>Hi ${escapeHtml(name)},</p>
         <p>Thank you for taking the time to speak with us — we enjoyed the conversation and would love to have you with us.</p>
         <p>We're now confirming apartment availability for your dates. As soon as that's done we'll send you a payment link to secure your place.</p>
         <p>There's nothing you need to do until then.</p>
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  /** Receipt for a payment an admin has confirmed landed. */
  async sendPaymentConfirmed(to: string, fullName: string): Promise<void> {
    const name = firstNameOf(fullName);
    await this.send({
      to,
      subject: 'Payment confirmed — welcome to Builders Node',
      text:
        `Hi ${name},\n\n` +
        "We've received your payment — your place at Builders Node is secured.\n\n" +
        "We're setting up your membership now and will email you once your account is fully active, with everything you need before arrival.\n\n" +
        'Best regards,\nBuilders Node',
      html: layout(
        'Payment confirmed',
        `<p>Hi ${escapeHtml(name)},</p>
         <p>We've received your payment — your place at Builders Node is secured.</p>
         <p>We're setting up your membership now and will email you once your account is fully active, with everything you need before arrival.</p>
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  /** The end of the pipeline: membership is live and the dashboard is theirs. */
  async sendMembershipActivated(to: string, fullName: string): Promise<void> {
    const name = firstNameOf(fullName);
    const dashboardUrl = `${this.frontendBaseUrl()}/home`;
    await this.send({
      to,
      subject: "You're now a Builders Node member 🎉",
      text:
        `Hi ${name},\n\n` +
        'Your membership is now active — welcome to Builders Node.\n\n' +
        `You can sign in to your dashboard here: ${dashboardUrl}\n\n` +
        'Inside you can see your apartment, book cleaning, reserve the community car, browse the member directory and join upcoming events.\n\n' +
        "If anything is unclear, just reply to this email — we're here.\n\n" +
        'Best regards,\nBuilders Node',
      html: layout(
        'Welcome to Builders Node',
        `<p>Hi ${escapeHtml(name)},</p>
         <p>Your membership is now active — welcome to Builders Node.</p>
         ${button('Open your dashboard', dashboardUrl)}
         <p>Inside you can see your apartment, book cleaning, reserve the community car, browse the member directory and join upcoming events.</p>
         <p>If anything is unclear, just reply to this email — we're here.</p>
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  /** A new invoice. The member can also see it in their account either way. */
  async sendInvoiceIssued(to: string, fullName: string, invoice: InvoiceEmail): Promise<void> {
    const name = firstNameOf(fullName);
    const amount = formatMoney(invoice.amountCents, invoice.currency);
    const due = formatDay(invoice.dueDate);
    const where = invoice.payUrl ? 'You can pay it here:' : 'You can see it in your account:';
    const link = invoice.payUrl ?? `${this.frontendBaseUrl()}/account`;

    await this.send({
      to,
      subject: `Invoice from Builders Node — ${amount} due ${due}`,
      text:
        `Hi ${name},\n\n` +
        `${invoice.description}\n${amount}, due ${due}.\n\n` +
        `${where} ${link}\n\n` +
        'Best regards,\nBuilders Node',
      html: layout(
        'A new invoice',
        `<p>Hi ${escapeHtml(name)},</p>
         <p>${escapeHtml(invoice.description)}<br /><strong>${amount}</strong>, due ${due}.</p>
         ${button(invoice.payUrl ? 'Pay now' : 'View in your account', link)}
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  /**
   * Sent the morning an invoice passes its due date — once, by the daily job.
   * Deliberately plain: someone is late, not in trouble.
   */
  async sendPaymentOverdue(to: string, fullName: string, invoice: InvoiceEmail): Promise<void> {
    const name = firstNameOf(fullName);
    const amount = formatMoney(invoice.amountCents, invoice.currency);
    const due = formatDay(invoice.dueDate);
    const link = invoice.payUrl ?? `${this.frontendBaseUrl()}/account`;

    await this.send({
      to,
      subject: `Payment overdue — ${amount}`,
      text:
        `Hi ${name},\n\n` +
        `${invoice.description} (${amount}) was due on ${due} and is still open.\n\n` +
        `You can settle it here: ${link}\n\n` +
        "If you've already paid or something needs sorting out, just reply to this email.\n\n" +
        'Best regards,\nBuilders Node',
      html: layout(
        'Payment overdue',
        `<p>Hi ${escapeHtml(name)},</p>
         <p>${escapeHtml(invoice.description)} (<strong>${amount}</strong>) was due on ${due} and is still open.</p>
         ${button('Settle it', link)}
         <p>If you've already paid or something needs sorting out, just reply to this email.</p>
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  /**
   * An answer to a support request. Sent as well as shown in the app, because
   * a reply nobody opens the app to find is the situation this replaces.
   */
  async sendSupportReply(to: string, fullName: string, subject: string, body: string): Promise<void> {
    const name = firstNameOf(fullName);
    const link = `${this.frontendBaseUrl()}/account`;
    await this.send({
      to,
      subject: `Re: ${subject}`,
      text:
        `Hi ${name},\n\n` +
        `${body}\n\n` +
        `You can reply from your account: ${link}\n\n` +
        'Best regards,\nBuilders Node',
      html: layout(
        `Re: ${escapeHtml(subject)}`,
        `<p>Hi ${escapeHtml(name)},</p>
         <p style="white-space:pre-wrap">${escapeHtml(body)}</p>
         ${button('Reply in your account', link)}
         <p>Best regards,<br />Builders Node</p>`,
      ),
    });
  }

  async sendInvitation(invitation: InvitationEmail): Promise<void> {
    await this.send({
      to: invitation.to,
      subject: invitation.subject,
      text: `Your Builders Node account is ready.\n\nTemporary password: ${invitation.temporaryPassword}\nSet your password: ${invitation.setupUrl}`,
      html: layout(
        'Your account is ready',
        `<p>An account has been created for you at Builders Node.</p>
         <p>Your temporary password is:</p>
         <p style="font-family:monospace;font-size:16px;background:#f3f4f6;padding:10px 14px;border-radius:8px;display:inline-block">${invitation.temporaryPassword}</p>
         <p>Use it to set a permanent password:</p>
         ${button('Set your password', invitation.setupUrl)}`,
      ),
    });
  }
}

/**
 * First name only. "Hi Robert" reads like a person wrote it; "Hi Robert Neufeld"
 * reads like a mail merge. Falls back to something that still scans.
 */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'there';
}

/**
 * The applicant's own name goes into HTML. It came from a public form, so an
 * apostrophe or an angle bracket must not be able to break the markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function button(label: string, url: string): string {
  return `<p><a href="${url}" style="background:#e5541f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block;font-weight:600">${label}</a></p>
          <p style="color:#6b7280;font-size:13px;word-break:break-all">Or paste this link: ${url}</p>`;
}

function layout(heading: string, body: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
    <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="color:#9ca3af;font-size:12px">Builders Node · Próspera</p>
  </div>`;
}

/** "$1,950" — whole units, since invoices here are never fractional. */
function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

/**
 * "3 February 2027", in UTC.
 *
 * A due date is a calendar day, and rendering it in the server's zone would
 * show the day before to anyone west of UTC — including Próspera, which is
 * where the people reading these emails are.
 */
function formatDay(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
