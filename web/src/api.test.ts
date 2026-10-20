import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, ApiError, login } from './api';

/**
 * No API is running during the tests: `fetch` is replaced by a fake that
 * answers what each test decides.
 */
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
  it('POSTs the username and the password as JSON to /auth/login', async () => {
    fetchMock.mockResolvedValue(Response.json({ access_token: 'the-token' }));

    await login('alice', 'secret');

    const request = sentRequest();
    expect(request.url).toBe(`${API_URL}/auth/login`);
    expect(request.method).toBe('POST');
    expect(request.headers.get('Content-Type')).toContain('application/json');
    await expect(request.json()).resolves.toEqual({ username: 'alice', password: 'secret' });
  });

  it('returns the access_token of the answer', async () => {
    fetchMock.mockResolvedValue(Response.json({ access_token: 'the-token' }));

    await expect(login('alice', 'secret')).resolves.toBe('the-token');
  });

  it('throws an ApiError whose status is 401 for a wrong password', async () => {
    fetchMock.mockResolvedValue(nestError(401, 'Wrong username or password'));

    const error = await rejection(login('alice', 'wrong'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
  });

  it('throws an ApiError when the API answers with an error that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const error = await rejection(login('alice', 'secret'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, details: [] });
  });

  it('keeps what the API explained about a 400 in `details`', async () => {
    fetchMock.mockResolvedValue(nestError(400, ['username should not be empty', 'password should not be empty']));

    const error = await rejection(login('', ''));
    expect(error).toMatchObject({
      status: 400,
      details: ['username should not be empty', 'password should not be empty'],
    });
  });
});
