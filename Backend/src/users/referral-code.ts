import { randomUUID } from 'crypto';

export function createReferralCode() {
  return `BUILDERS-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}
