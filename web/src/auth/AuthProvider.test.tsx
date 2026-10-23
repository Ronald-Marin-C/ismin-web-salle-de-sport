import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api';
import { fakeApi, makeToken, nestError } from '../test-utils';
import { AuthProvider, TOKEN_KEY, useAuth } from './AuthProvider';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const token = makeToken({ email: 'referent1@castelmont.fr', role: 'referent' });

describe('AuthProvider', () => {
  it('starts logged out when localStorage holds no token', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('logs in: keeps the token, in the state and in localStorage, and reads the user from it', async () => {
    fakeApi({ 'POST /auth/login': () => Response.json({ access_token: token }) });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => result.current.login('referent1@castelmont.fr', 'salle-de-sport'));

    expect(result.current.token).toBe(token);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
    expect(result.current.user).toMatchObject({ email: 'referent1@castelmont.fr', role: 'referent' });
  });

  it('lets the ApiError of a wrong password through, and stays logged out', async () => {
    fakeApi({ 'POST /auth/login': () => nestError(401, 'Email ou mot de passe incorrect.') });
    const { result } = renderHook(() => useAuth(), { wrapper });

    let error: unknown;
    await act(() => result.current.login('referent1@castelmont.fr', 'wrong').catch((e: unknown) => (error = e)));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('registers: keeps the token of the new account, and reads the user from it', async () => {
    const newToken = makeToken({ email: 'chloe.petit@castelmont.fr' });
    fakeApi({ 'POST /auth/register': () => Response.json({ access_token: newToken }, { status: 201 }) });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() =>
      result.current.register({
        firstName: 'Chloé',
        lastName: 'Petit',
        email: 'chloe.petit@castelmont.fr',
        password: 'correct-horse',
      }),
    );

    expect(result.current.token).toBe(newToken);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(newToken);
    expect(result.current.user).toMatchObject({ email: 'chloe.petit@castelmont.fr', role: 'student' });
  });

  it('is still logged in after a reload: the token is read from localStorage', () => {
    localStorage.setItem(TOKEN_KEY, token);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.token).toBe(token);
    expect(result.current.user?.email).toBe('referent1@castelmont.fr');
  });

  it('logs out: forgets the token, in the state and in localStorage', () => {
    localStorage.setItem(TOKEN_KEY, token);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user?.email).toBe('referent1@castelmont.fr');

    act(() => result.current.logout());

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(result.current.sessionEnded).toBe(false);
  });

  it('ends the session: forgets the token and remembers it ended, until the next login', async () => {
    fakeApi({ 'POST /auth/login': () => Response.json({ access_token: token }) });
    localStorage.setItem(TOKEN_KEY, token);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.sessionEnded).toBe(false);

    act(() => result.current.endSession());

    expect(result.current.token).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(result.current.sessionEnded).toBe(true);

    await act(() => result.current.login('referent1@castelmont.fr', 'salle-de-sport'));

    expect(result.current.sessionEnded).toBe(false);
  });
});
