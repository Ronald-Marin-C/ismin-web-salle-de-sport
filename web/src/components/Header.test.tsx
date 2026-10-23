import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TOKEN_KEY } from '../auth/AuthProvider';
import { bob, fakeApi, makeToken, renderApp } from '../test-utils';

describe('Header', () => {
  it('offers to log in when logged out', () => {
    renderApp('/');

    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument();
  });

  it('shows no link to the pages of the logged-in when logged out', () => {
    renderApp('/');

    expect(screen.queryByRole('link', { name: 'Planning' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mes créneaux' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Initiations' })).not.toBeInTheDocument();
  });

  it('shows a student the planning and their slots, but not the initiations', async () => {
    renderApp('/', { token: makeToken() });
    await screen.findByText('Alice Martin');

    expect(screen.getByRole('link', { name: 'Planning' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Mes créneaux' })).toHaveAttribute('href', '/my-registrations');
    expect(screen.queryByRole('link', { name: 'Initiations' })).not.toBeInTheDocument();
  });

  it('shows a referent the initiations too', async () => {
    renderApp('/', { token: makeToken({ email: 'referent1@castelmont.fr', role: 'referent' }) });
    await screen.findByText('Alice Martin');

    expect(screen.getByRole('link', { name: 'Planning' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Mes créneaux' })).toHaveAttribute('href', '/my-registrations');
    expect(screen.getByRole('link', { name: 'Initiations' })).toHaveAttribute('href', '/referent/initiations');
  });

  it('marks the link of the planning on the planning, and only that one', async () => {
    renderApp('/', { token: makeToken() });
    await screen.findByText('Alice Martin');

    const planning = screen.getByRole('link', { name: 'Planning' });
    expect(planning).toHaveClass('active');
    expect(planning).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Mes créneaux' })).not.toHaveClass('active');
  });

  it('marks the link of my slots on my slots, and not the planning', async () => {
    renderApp('/my-registrations', { token: makeToken() });
    await screen.findByText('Alice Martin');

    const mine = screen.getByRole('link', { name: 'Mes créneaux' });
    expect(mine).toHaveClass('active');
    expect(mine).toHaveAttribute('aria-current', 'page');
    const planning = screen.getByRole('link', { name: 'Planning' });
    expect(planning).not.toHaveClass('active');
    expect(planning).not.toHaveAttribute('aria-current');
  });

  it('marks the link of the initiations on the initiations', async () => {
    renderApp('/referent/initiations', { token: makeToken({ email: 'referent1@castelmont.fr', role: 'referent' }) });
    await screen.findByText('Alice Martin');

    expect(screen.getByRole('link', { name: 'Initiations' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'Planning' })).not.toHaveClass('active');
  });

  it('shows the name of the logged-in user, and offers to log out', async () => {
    renderApp('/', { token: makeToken() });

    expect(await screen.findByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('shows the name of Bob for the profile of Bob: it comes from the API, not from the code', async () => {
    fakeApi({ 'GET /auth/me': () => Response.json(bob) });
    renderApp('/', { token: makeToken({ email: 'bob.durand@castelmont.fr' }) });

    expect(await screen.findByText('Bob Durand')).toBeInTheDocument();
  });

  it('logs out on a click on "Se déconnecter", without saying the session ended', async () => {
    renderApp('/', { token: makeToken() });
    await screen.findByText('Alice Martin');

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.queryByText('Votre session a pris fin. Reconnectez-vous.')).not.toBeInTheDocument();
  });
});
