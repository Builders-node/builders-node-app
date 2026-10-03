import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';

/**
 * What a session token carries.
 *
 * `sv` is the user's `sessionVersion` at the moment the token was issued.
 * Tokens from before it existed have none and count as version 0, which is
 * what every account starts at — so nobody was logged out by its arrival.
 *
 * `purpose` is never set on a session. Other short-lived tokens signed with the
 * same secret (the Discord OAuth `state`) carry one, and the guards refuse any
 * token that has it: otherwise a value that travels through URLs and logs
 * would double as a ten-minute login.
 */
export type SessionPayload = {
  sub: string;
  email?: string;
  role?: string;
  sv?: number;
  purpose?: string;
};

export function signSession(
  jwt: JwtService,
  user: { id: string; email: string; role: string; sessionVersion: number },
): { accessToken: string; user: { id: string; email: string; role: string } } {
  return {
    accessToken: jwt.sign({ sub: user.id, email: user.email, role: user.role, sv: user.sessionVersion }),
    user: { id: user.id, email: user.email, role: user.role },
  };
}

/** True when a token is a live session for this user as they are now. */
export function sessionMatches(payload: SessionPayload, user: { sessionVersion: number } | null): boolean {
  if (!user || payload.purpose) return false;
  return (payload.sv ?? 0) === user.sessionVersion;
}

/**
 * Take an account back from whoever registered it without owning the address.
 *
 * Signing up never proved the email, so anyone could create an account for an
 * address that isn't theirs and wait. When the real owner later proves it — by
 * Google, by the code the apply form emails, or by being accepted off an
 * application — the account becomes theirs, but the squatter still knew its
 * password and still held a session. This replaces the password with one
 * nobody knows (the owner sets theirs through reset or Google), ends every
 * existing session, and marks the address as proven.
 *
 * Only for accounts whose address was never verified. A verified account is
 * already its owner's, and rotating its password would lock them out.
 */
export async function reclaimUnverifiedAccount(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(randomUUID(), 12),
      sessionVersion: { increment: 1 },
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
}
