import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InvitationEmail } from '../auth/invitation';

type Email = { to: string; subject: string; html: string; text: string };

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
    const urls = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const preferred = urls.find((url) => !/\.vercel\.app(?:\/|$)/.test(url)) ?? urls[0];
    return preferred.replace(/\/+$/, '');
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
