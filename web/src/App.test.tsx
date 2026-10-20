import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeToken, renderApp } from './test-utils';

/**
 * From TP8: one URL, one page, and links to go from one to the other. The
 * heading "Planning" tells which page is shown: only the planning has it.
 * The planning is for the logged-in only, hence the token.
 */
const token = makeToken({ username: 'alice' });

function planningIsShown() {
  return screen.queryByRole('heading', { name: 'Planning' }) !== null;
}

describe('App, the routes', () => {
  it('shows the planning on /', () => {
    renderApp('/', { token });

    expect(planningIsShown()).toBe(true);
  });

  it('shows "Page introuvable" on a URL that no route knows, and not the planning', () => {
    renderApp('/nimporte-quoi', { token });

    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument();
    expect(planningIsShown()).toBe(false);
  });

  it('shows the login page on /login, and not the planning', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(planningIsShown()).toBe(false);
  });
});

describe('App, the links', () => {
  it('goes back to the planning from the 404 page', async () => {
    renderApp('/nimporte-quoi', { token });

    await userEvent.click(screen.getByRole('link', { name: 'Retour au planning' }));

    expect(planningIsShown()).toBe(true);
  });

  it('opens the login page from the header when logged out', async () => {
    renderApp('/nimporte-quoi');

    await userEvent.click(screen.getByRole('link', { name: 'Se connecter' }));

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });

  it('goes back to the planning with the title of the header', async () => {
    renderApp('/nimporte-quoi', { token });
    expect(planningIsShown()).toBe(false);

    await userEvent.click(screen.getByRole('link', { name: 'Salle de sport' }));

    expect(planningIsShown()).toBe(true);
  });
});
