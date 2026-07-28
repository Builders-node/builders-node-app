import { randomBytes } from 'crypto';

/**
 * A high-entropy temporary password for invited members (~130 bits). Replaces the
 * old `BuildersNode-<8 hex>` scheme, which had a predictable prefix and only ~32
 * bits of entropy. The member changes it on first login via the setup link.
 */
export function createTemporaryPassword(): string {
  // base64url avoids ambiguous URL-unsafe chars; 16 bytes ≈ 22 chars.
  return randomBytes(16).toString('base64url');
}
