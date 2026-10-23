import type { Me, NewAccount, Registration, SlotView } from './types';

/** The fallback is the port of `npm run start:dev`. */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** A 4xx or 5xx answer of the API. `details` holds its messages, one per invalid field for a 400. */
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
 * Throws an ApiError when the answer is not ok. NestJS puts its error in the
 * body as `{ statusCode, message, error }`, where `message` is a sentence or,
 * for a 400, a list of sentences.
 */
export async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;

  const body: unknown = await res.json().catch(() => undefined);
  const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
  const details = Array.isArray(message) ? message.map(String) : typeof message === 'string' ? [message] : [];
  throw new ApiError(res.status, `L'API a répondu ${res.status}`, details);
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  await throwIfNotOk(res);
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

export async function register(account: NewAccount): Promise<string> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  await throwIfNotOk(res);
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

export async function fetchMe(token: string): Promise<Me> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return (await res.json()) as Me;
}

export async function fetchSlots(token: string): Promise<SlotView[]> {
  const res = await fetch(`${API_URL}/slots`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return (await res.json()) as SlotView[];
}

/** A place in the slot while there is one, otherwise a place in its waiting list. */
export async function bookSlot(date: string, hour: number, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/slots/${date}/${hour}/registrations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
}

export async function fetchMyRegistrations(token: string): Promise<Registration[]> {
  const res = await fetch(`${API_URL}/registrations/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return (await res.json()) as Registration[];
}

/** The API answers 204, without a body. A place held goes to the first in the waiting list. */
export async function cancelRegistration(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/registrations/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
}
