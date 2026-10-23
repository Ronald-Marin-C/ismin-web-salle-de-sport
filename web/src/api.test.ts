import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, ApiError, fetchMe, login, register } from './api';
import { alice } from './test-utils';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
});

/** The n-th request made to fetch, whatever form the code gave it: a URL and options, or a Request. */
function sentRequest(call = 0): Request {
  const [input, init] = fetchMock.mock.calls[call];
  return new Request(input, init);
}

/** The error a promise rejects with. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

/** An error the way NestJS sends them. */
function nestError(status: number, message: string | string[]): Response {
  return Response.json({ statusCode: status, message }, { status });
}

describe('login', () => {
  it('POSTs the email and the password as JSON to /auth/login', async () => {
    fetchMock.mockResolvedValue(Response.json({ access_token: 'the-token' }));

    await login('alice.martin@castelmont.fr', 'salle-de-sport');

    const request = sentRequest();
    expect(request.url).toBe(`${API_URL}/auth/login`);
    expect(request.method).toBe('POST');
    expect(request.headers.get('Content-Type')).toContain('application/json');
    await expect(request.json()).resolves.toEqual({ email: 'alice.martin@castelmont.fr', password: 'salle-de-sport' });
  });

  it('returns the access_token of the answer', async () => {
    fetchMock.mockResolvedValue(Response.json({ access_token: 'the-token' }));

    await expect(login('alice.martin@castelmont.fr', 'salle-de-sport')).resolves.toBe('the-token');
  });

  it('throws an ApiError whose status is 401 for a wrong password', async () => {
    fetchMock.mockResolvedValue(nestError(401, 'Email ou mot de passe incorrect.'));

    const error = await rejection(login('alice.martin@castelmont.fr', 'wrong'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
  });

  it('throws an ApiError when the API answers with an error that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const error = await rejection(login('alice.martin@castelmont.fr', 'salle-de-sport'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, details: [] });
  });

  it('keeps what the API explained about a 400 in `details`', async () => {
    fetchMock.mockResolvedValue(nestError(400, ['email must be an email', 'password should not be empty']));

    const error = await rejection(login('', ''));
    expect(error).toMatchObject({
      status: 400,
      details: ['email must be an email', 'password should not be empty'],
    });
  });
});

describe('register', () => {
  const chloe = {
    firstName: 'Chloé',
    lastName: 'Petit',
    email: 'chloe.petit@castelmont.fr',
    password: 'correct-horse',
  };

  it('POSTs the four fields as JSON to /auth/register', async () => {
    fetchMock.mockResolvedValue(Response.json({ access_token: 'the-token' }, { status: 201 }));

    await register(chloe);

    const request = sentRequest();
    expect(request.url).toBe(`${API_URL}/auth/register`);
    expect(request.method).toBe('POST');
    expect(request.headers.get('Content-Type')).toContain('application/json');
    await expect(request.json()).resolves.toEqual(chloe);
  });

  it('returns the access_token of the answer', async () => {
    fetchMock.mockResolvedValue(Response.json({ access_token: 'the-token' }, { status: 201 }));

    await expect(register(chloe)).resolves.toBe('the-token');
  });

  it('throws an ApiError carrying the message of the API when the email is already used', async () => {
    fetchMock.mockResolvedValue(nestError(409, 'Cet email est déjà utilisé.'));

    const error = await rejection(register(chloe));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, details: ['Cet email est déjà utilisé.'] });
  });
});

describe('fetchMe', () => {
  it('GETs /auth/me with the token in the Authorization header', async () => {
    fetchMock.mockResolvedValue(Response.json(alice));

    await fetchMe('the-token');

    const request = sentRequest();
    expect(request.url).toBe(`${API_URL}/auth/me`);
    expect(request.method).toBe('GET');
    expect(request.headers.get('Authorization')).toBe('Bearer the-token');
  });

  it('returns the profile of the answer', async () => {
    fetchMock.mockResolvedValue(Response.json(alice));

    await expect(fetchMe('the-token')).resolves.toEqual(alice);
  });

  it('throws an ApiError whose status is 401 when the API refuses the token', async () => {
    fetchMock.mockResolvedValue(nestError(401, 'Compte introuvable.'));

    const error = await rejection(fetchMe('the-token'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
  });
});
