import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LoginPage } from '../pages/LoginPage';
import { fakeApi, makeToken, renderApp } from '../test-utils';
import { AuthProvider } from './AuthProvider';
import { RequireAuth } from './RequireAuth';

/**
 * The planning, at /, is for the logged-in only.
 *
 * After a login, the login page goes to / when it was not sent by
 * RequireAuth. To prove that it comes back to the page that was asked for,
 * the last test guards another page, /secret, next to the real login page.
 */
function renderGuardedPage(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<h2>Accueil</h2>} />
          <Route
            path="/secret"
            element={
              <RequireAuth>
                <h2>Page protégée</h2>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('shows the planning to a logged-in user', () => {
    renderApp('/', { token: makeToken() });

    expect(screen.getByRole('heading', { name: 'Planning' })).toBeInTheDocument();
  });

  it('sends a logged-out user to the login page instead', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Planning' })).not.toBeInTheDocument();
  });

  it('comes back to the page that was asked for, once logged in', async () => {
    fakeApi({ 'POST /auth/login': () => Response.json({ access_token: makeToken() }) });
    renderGuardedPage('/secret');
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email'), 'alice.martin@castelmont.fr');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'salle-de-sport');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('heading', { name: 'Page protégée' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Accueil' })).not.toBeInTheDocument();
  });
});
