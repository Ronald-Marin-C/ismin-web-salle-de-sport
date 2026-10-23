import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_KEY } from '../auth/AuthProvider';
import { alice, bob, fakeApi, makeToken, nestError, pathOf, renderApp } from '../test-utils';
import type { Registration } from '../types';

const confirmed: Registration = {
  id: 'r1',
  date: '2026-10-21',
  hour: 18,
  status: 'confirmed',
  startsAt: '2026-10-21T16:00:00.000Z',
};

const waiting: Registration = {
  id: 'r2',
  date: '2026-10-22',
  hour: 19,
  status: 'waiting',
  position: 2,
  startsAt: '2026-10-22T17:00:00.000Z',
};

const noContent = () => new Response(null, { status: 204 });

// The deadline depends on the clock: Wednesday 21 October 2026, 10:30 in Paris, unless a test moves it.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T10:30:00+02:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

function rowOf(hours: string): HTMLElement {
  return screen.getByText(hours).closest('li')!;
}

function cancelButtonOf(hours: string): HTMLElement {
  return within(rowOf(hours)).getByRole('button', { name: 'Se désinscrire' });
}

/** Logs Alice in after the clock is set, then opens the page and waits for the list. */
async function openPage(): Promise<string> {
  const token = makeToken();
  renderApp('/my-registrations', { token });
  await screen.findByText('18:00 – 19:00');
  return token;
}

describe('MyRegistrationsPage, the list', () => {
  it('opens from the header', async () => {
    renderApp('/', { token: makeToken() });

    await userEvent.click(screen.getByRole('link', { name: 'Mes créneaux' }));

    expect(screen.getByRole('heading', { name: 'Mes créneaux' })).toBeInTheDocument();
  });

  it('shows a loading status, then the registrations', async () => {
    fakeApi({ 'GET /registrations/me': () => Response.json([confirmed]) });
    renderApp('/my-registrations', { token: makeToken() });

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(await screen.findByText('18:00 – 19:00')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lists the places held and the places in a waiting list, with their day and hours', async () => {
    fakeApi({ 'GET /registrations/me': () => Response.json([confirmed, waiting]) });
    await openPage();

    const first = rowOf('18:00 – 19:00');
    expect(first).toHaveTextContent('mer. 21/10');
    expect(within(first).getByText('Inscrit')).toBeInTheDocument();
    const second = rowOf('19:00 – 20:00');
    expect(second).toHaveTextContent('jeu. 22/10');
    expect(within(second).getByText('En attente (n°2)')).toBeInTheDocument();
  });

  it('asks for the registrations with the token', async () => {
    const requests = fakeApi({ 'GET /registrations/me': () => Response.json([confirmed]) });
    const token = await openPage();

    const mine = requests.find((request) => request.method === 'GET' && pathOf(request) === '/registrations/me');
    expect(mine?.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('says so when there is no registration', async () => {
    fakeApi({ 'GET /registrations/me': () => Response.json([]) });
    renderApp('/my-registrations', { token: makeToken() });

    expect(await screen.findByText('Aucune réservation pour les 7 prochains jours.')).toBeInTheDocument();
  });

  it('says so when the registrations cannot be loaded', async () => {
    fakeApi({ 'GET /registrations/me': () => nestError(500, 'Internal server error') });
    renderApp('/my-registrations', { token: makeToken() });

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger vos créneaux');
  });

  it('never shows the registrations of the previous account after a change of account', async () => {
    const bobToken = makeToken({ email: 'bob.durand@castelmont.fr' });
    const isBob = (request: Request) => request.headers.get('Authorization') === `Bearer ${bobToken}`;
    fakeApi({
      'GET /auth/me': (request) => Response.json(isBob(request) ? bob : alice),
      'GET /registrations/me': (request) =>
        isBob(request) ? new Promise<Response>(() => {}) : Response.json([confirmed]),
      'POST /auth/login': () => Response.json({ access_token: bobToken }),
    });
    await openPage();

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await userEvent.type(screen.getByLabelText('Email'), 'bob.durand@castelmont.fr');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'salle-de-sport');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('heading', { name: 'Mes créneaux' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(screen.queryByText('18:00 – 19:00')).not.toBeInTheDocument();
  });
});

describe('MyRegistrationsPage, the deadline', () => {
  it('closes the cancellation less than an hour before the slot', async () => {
    vi.setSystemTime(new Date('2026-10-21T17:30:00+02:00'));
    fakeApi({ 'GET /registrations/me': () => Response.json([confirmed]) });
    await openPage();

    expect(cancelButtonOf('18:00 – 19:00')).toBeDisabled();
    expect(within(rowOf('18:00 – 19:00')).getByText('Désinscription fermée')).toBeInTheDocument();
  });

  it('closes it one second after the hour before the slot', async () => {
    vi.setSystemTime(new Date('2026-10-21T17:00:01+02:00'));
    fakeApi({ 'GET /registrations/me': () => Response.json([confirmed]) });
    await openPage();

    expect(cancelButtonOf('18:00 – 19:00')).toBeDisabled();
  });

  it('still allows it exactly an hour before the slot, as the API', async () => {
    vi.setSystemTime(new Date('2026-10-21T17:00:00+02:00'));
    fakeApi({ 'GET /registrations/me': () => Response.json([confirmed]) });
    await openPage();

    expect(cancelButtonOf('18:00 – 19:00')).toBeEnabled();
    expect(screen.queryByText('Désinscription fermée')).not.toBeInTheDocument();
  });

  it('closes it for a place in a waiting list too, and only for the slot that is too close', async () => {
    vi.setSystemTime(new Date('2026-10-22T18:30:00+02:00'));
    fakeApi({
      'GET /registrations/me': () =>
        Response.json([
          waiting,
          { ...confirmed, id: 'r3', date: '2026-10-22', hour: 21, startsAt: '2026-10-22T19:00:00.000Z' },
        ]),
    });
    renderApp('/my-registrations', { token: makeToken() });
    await screen.findByText('19:00 – 20:00');

    expect(cancelButtonOf('19:00 – 20:00')).toBeDisabled();
    expect(cancelButtonOf('21:00 – 22:00')).toBeEnabled();
  });
});

describe('MyRegistrationsPage, cancelling', () => {
  it('cancels with DELETE /registrations/:id and the token', async () => {
    const requests = fakeApi({
      'GET /registrations/me': () => Response.json([confirmed, waiting]),
      'DELETE /registrations/r1': noContent,
    });
    const token = await openPage();

    await userEvent.click(cancelButtonOf('18:00 – 19:00'));

    const deletion = requests.find((request) => request.method === 'DELETE');
    expect(deletion && pathOf(deletion)).toBe('/registrations/r1');
    expect(deletion?.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('removes the registration from the list once cancelled', async () => {
    let cancelled = false;
    fakeApi({
      'GET /registrations/me': () => Response.json(cancelled ? [waiting] : [confirmed, waiting]),
      'DELETE /registrations/r1': () => {
        cancelled = true;
        return noContent();
      },
    });
    await openPage();

    await userEvent.click(cancelButtonOf('18:00 – 19:00'));

    await waitFor(() => expect(screen.queryByText('18:00 – 19:00')).not.toBeInTheDocument());
    expect(screen.getByText('19:00 – 20:00')).toBeInTheDocument();
  });

  it.each([
    [403, 'Cette inscription ne vous appartient pas.'],
    [404, 'Inscription introuvable.'],
    [422, "Désinscription possible jusqu'à une heure avant le créneau."],
  ])('shows the message of the API for a %i', async (status, message) => {
    fakeApi({
      'GET /registrations/me': () => Response.json([confirmed]),
      'DELETE /registrations/r1': () => nestError(status, message),
    });
    await openPage();

    await userEvent.click(cancelButtonOf('18:00 – 19:00'));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('says so in French when the API fails, without its message', async () => {
    fakeApi({
      'GET /registrations/me': () => Response.json([confirmed]),
      'DELETE /registrations/r1': () => nestError(500, 'Internal server error'),
    });
    await openPage();

    await userEvent.click(cancelButtonOf('18:00 – 19:00'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Désinscription impossible : L'API a répondu 500");
    expect(alert).not.toHaveTextContent('Internal server error');
  });

  it('clears the error at the next cancellation', async () => {
    fakeApi({
      'GET /registrations/me': () => Response.json([confirmed, waiting]),
      'DELETE /registrations/r1': () => nestError(404, 'Inscription introuvable.'),
      'DELETE /registrations/r2': noContent,
    });
    await openPage();
    await userEvent.click(cancelButtonOf('18:00 – 19:00'));
    await screen.findByRole('alert');

    await userEvent.click(cancelButtonOf('19:00 – 20:00'));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('keeps the buttons disabled until the list no longer shows the cancelled registration', async () => {
    let calls = 0;
    let release: () => void = () => {};
    let answer: (response: Response) => void = () => {};
    fakeApi({
      'GET /registrations/me': async () => {
        const call = ++calls;
        if (call > 1) await new Promise<void>((resolve) => (release = resolve));
        return Response.json(call > 1 ? [waiting] : [confirmed, waiting]);
      },
      'DELETE /registrations/r1': () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    await openPage();

    await userEvent.click(cancelButtonOf('18:00 – 19:00'));

    expect(cancelButtonOf('18:00 – 19:00')).toBeDisabled();
    expect(cancelButtonOf('19:00 – 20:00')).toBeDisabled();
    answer(noContent());
    await waitFor(() => expect(calls).toBe(2));
    expect(cancelButtonOf('19:00 – 20:00')).toBeDisabled();
    release();
    await waitFor(() => expect(screen.queryByText('18:00 – 19:00')).not.toBeInTheDocument());
    expect(cancelButtonOf('19:00 – 20:00')).toBeEnabled();
  });

  it('logs out when the API refuses the token, and the login page says the session ended', async () => {
    fakeApi({
      'GET /registrations/me': () => Response.json([confirmed]),
      'DELETE /registrations/r1': () => nestError(401, 'Invalid or expired token'),
    });
    await openPage();

    await userEvent.click(cancelButtonOf('18:00 – 19:00'));

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByText('Votre session a pris fin. Reconnectez-vous.')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
