/** Where the API runs, read from `.env`. The fallback is the port of `npm run start:dev`. */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * An answer of the API that is not ok: a 4xx or a 5xx. `status` says
 * which one, and the pages decide what to show from it. `details` holds what
 * the API explained, one sentence per invalid field for a 400.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Does nothing when the answer is ok, throws an ApiError otherwise.
 *
 * NestJS explains its errors in the body, `{ statusCode, message, error }`:
 * `message` is a sentence, or a list of sentences for a 400.
 */
export async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;

  const body: unknown = await res.json().catch(() => undefined);
  const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
  const details = Array.isArray(message) ? message.map(String) : typeof message === 'string' ? [message] : [];
  throw new ApiError(res.status, `L'API a répondu ${res.status}`, details);
}

/**
 * POST /auth/login, and the `access_token` of the answer. A wrong password: 401.
 *
 * A JSON body needs its header, `'Content-Type': 'application/json'`:
 * without it, NestJS does not read the body.
 */
export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  await throwIfNotOk(res);
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}
