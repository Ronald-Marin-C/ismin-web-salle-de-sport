import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hashes a password with scrypt and a random salt: only this hash is stored,
 * never the password. The salt makes two identical passwords hash differently.
 *
 * @returns The salt and the hash, both in hex, as `salt:hash`.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Checks a password against a value made by {@link hashPassword}. The
 * comparison takes the same time whatever the input, so the response time
 * reveals nothing about the stored hash.
 *
 * @returns `true` when the password matches; `false` otherwise, including
 * when `stored` is not in the `salt:hash` format.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
