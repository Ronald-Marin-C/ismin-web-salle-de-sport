import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import App from './App';
import { AuthProvider, TOKEN_KEY } from './auth/AuthProvider';
import type { Me, Role, SlotView } from './types';

/** The default user of the tests: what `GET /auth/me` answers unless a test says otherwise. */
export const alice: Me = {
  id: 'u1',
  email: 'alice.martin@castelmont.fr',
  firstName: 'Alice',
  lastName: 'Martin',
  role: 'student',
  initiationValidated: true,
};

export const bob: Me = {
  id: 'u2',
  email: 'bob.durand@castelmont.fr',
  firstName: 'Bob',
  lastName: 'Durand',
  role: 'student',
  initiationValidated: false,
};

/** A free slot nobody booked, on Wednesday 21 October 2026 at 11:00 unless `changes` says otherwise. */
export function makeSlot(changes: Partial<SlotView> = {}): SlotView {
  const { date = '2026-10-21', hour = 11 } = changes;
  return {
    date,
    hour,
    startsAt: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+02:00`).toISOString(),
    remaining: 12,
    waitingCount: 0,
    isPast: false,
    ...changes,
  };
}

/**
 * The whole app, as main.tsx mounts it, at `route`. With a token, the user
 * is already logged in, as after a reload. Failed requests are not retried.
 */
export function renderApp(route = '/', { token }: { token?: string } = {}) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** One component alone, with a router around it for its <Link>. */
export function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/**
 * A token shaped like the API's, valid for an hour. The signature is fake:
 * only the API checks it.
 */
export function makeToken({
  email = 'alice.martin@castelmont.fr',
  role = 'student',
}: { email?: string; role?: Role } = {}): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: 'u1', email, role, iat: now, exp: now + 3600 });
  return `${header}.${payload}.fake-signature`;
}

/** What the fake API answers to one request. */
type Handler = (request: Request) => Response | Promise<Response>;

const defaultRoutes: Record<string, Handler> = {
  'GET /auth/me': () => Response.json(alice),
  'GET /slots': () => Response.json([]),
};

/**
 * Replaces `fetch` by a fake API. `routes` maps a method and a path to an
 * answer: `{ 'GET /slots': () => Response.json([...]) }`. The query string
 * counts when the route has one. Unless `routes` overrides them, `GET /auth/me`
 * answers Alice and `GET /slots` an empty planning; any other request: 404.
 *
 * Returns the requests made, to check what the app sent.
 */
export function fakeApi(routes: Record<string, Handler>): Request[] {
  const requests: Request[] = [];
  const allRoutes = { ...defaultRoutes, ...routes };

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    const { pathname, search } = new URL(request.url);
    const handler = allRoutes[`${request.method} ${pathname}${search}`] ?? allRoutes[`${request.method} ${pathname}`];
    if (!handler) {
      return Response.json({ statusCode: 404, message: `No fake for ${request.method} ${pathname}` }, { status: 404 });
    }
    return handler(request);
  };

  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  return requests;
}

/** An error the way NestJS sends them. */
export function nestError(status: number, message: string | string[]): Response {
  return Response.json({ statusCode: status, message }, { status });
}

/** The path and query of a request, without the host: "/users?search=martin". */
export function pathOf(request: Request): string {
  const { pathname, search } = new URL(request.url);
  return pathname + search;
}
