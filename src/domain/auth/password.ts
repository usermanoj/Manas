import { createHash, randomBytes } from 'crypto';

/**
 * Demo password hasher. NOT production-grade.
 *
 * Uses SHA-256 with a random salt. Provided only for the P0 demonstration so
 * that login/register flows can work without adding external dependencies.
 * A real deployment must replace this with bcrypt, Argon2, or similar.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computed = createHash('sha256').update(salt + password).digest('hex');
  return computed === hash;
}
