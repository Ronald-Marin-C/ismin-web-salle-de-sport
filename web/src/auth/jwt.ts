import type { Role } from '../types';

/** The payload of the tokens the API signs. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

/**
 * Reads the payload of a JWT, or null when the token cannot be read. The
 * signature is not checked: the payload only serves for display, and the API
 * checks the token on every request.
 */
export function decodePayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    // base64url has - and _ where base64 has + and /.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch {
    return null;
  }
}
