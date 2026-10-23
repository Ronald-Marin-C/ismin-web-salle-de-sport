import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { alice, bob, fakeApi, makeToken, nestError, renderApp } from '../test-utils';
import { AuthProvider, TOKEN_KEY, useAuth } from './AuthProvider';
import { useMe } from './useMe';

function renderUseMe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return renderHook(() => ({ auth: useAuth(), me: useMe() }), { wrapper });
}

const aliceToken = makeToken();
const bobToken = makeToken({ email: 'bob.durand@castelmont.fr' });

describe('useMe', () => {
  it('logs out when the API refuses the token, and the login page says the session ended', async () => {
    fakeApi({ 'GET /auth/me': () => nestError(401, 'Compte introuvable.') });
    renderApp('/', { token: aliceToken });

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByText('Votre session a pris fin. Reconnectez-vous.')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('stays logged in when /auth/me fails for another reason', async () => {
    fakeApi({ 'GET /auth/me': () => nestError(500, 'Internal server error') });
    localStorage.setItem(TOKEN_KEY, aliceToken);
    const { result } = renderUseMe();

    await waitFor(() => expect(result.current.me.isError).toBe(true));

    expect(result.current.auth.token).toBe(aliceToken);
    expect(result.current.auth.sessionEnded).toBe(false);
  });

  it('never shows the profile of the previous account after a change of account', async () => {
    let answerBob: (response: Response) => void = () => {};
    fakeApi({
      'POST /auth/login': () => Response.json({ access_token: bobToken }),
      'GET /auth/me': (request) =>
        request.headers.get('Authorization') === `Bearer ${aliceToken}`
          ? Response.json(alice)
          : new Promise<Response>((resolve) => (answerBob = resolve)),
    });
    localStorage.setItem(TOKEN_KEY, aliceToken);
    const { result } = renderUseMe();
    await waitFor(() => expect(result.current.me.data).toEqual(alice));

    act(() => result.current.auth.logout());
    await act(() => result.current.auth.login('bob.durand@castelmont.fr', 'salle-de-sport'));

    expect(result.current.me.data).toBeUndefined();
    answerBob(Response.json(bob));
    await waitFor(() => expect(result.current.me.data).toEqual(bob));
  });
});
