import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TOKEN_KEY } from '../auth/AuthProvider';
import { fakeApi, makeToken, nestError, pathOf, renderApp } from '../test-utils';

const token = makeToken();

async function logInAs(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Mot de passe'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('LoginPage', () => {
  it('sends what was typed to POST /auth/login', async () => {
    const requests = fakeApi({ 'POST /auth/login': () => Response.json({ access_token: token }) });
    renderApp('/login');

    await logInAs('alice.martin@castelmont.fr', 'salle-de-sport');

    const login = requests.find((request) => request.method === 'POST' && pathOf(request) === '/auth/login');
    expect(login).toBeDefined();
    await expect(login!.json()).resolves.toEqual({ email: 'alice.martin@castelmont.fr', password: 'salle-de-sport' });
  });

  it('goes to the planning once logged in, and keeps the token', async () => {
    fakeApi({ 'POST /auth/login': () => Response.json({ access_token: token }) });
    renderApp('/login');

    await logInAs('alice.martin@castelmont.fr', 'salle-de-sport');

    expect(await screen.findByRole('heading', { name: 'Planning' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
  });

  it('says so on a wrong password, and stays on the page', async () => {
    fakeApi({ 'POST /auth/login': () => nestError(401, 'Email ou mot de passe incorrect.') });
    renderApp('/login');

    await logInAs('alice.martin@castelmont.fr', 'wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.');
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('shows the demo accounts and their password', () => {
    renderApp('/login');

    const hint = screen.getByText(/comptes de démonstration/i);
    expect(hint).toHaveTextContent('referent1@castelmont.fr');
    expect(hint).toHaveTextContent('alice.martin@castelmont.fr');
    expect(hint).toHaveTextContent('salle-de-sport');
  });

  it('says nothing about an ended session to a user who just arrived', () => {
    renderApp('/login');

    expect(screen.queryByText('Votre session a pris fin. Reconnectez-vous.')).not.toBeInTheDocument();
  });
});
