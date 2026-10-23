import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { alice, bob, fakeApi, makeSlot, makeToken, nestError, pathOf, renderApp } from '../test-utils';
import type { SlotView } from '../types';

const DATES = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
const DAY_LABELS = ['mer. 21/10', 'jeu. 22/10', 'ven. 23/10', 'sam. 24/10', 'dim. 25/10', 'lun. 26/10', 'mar. 27/10'];
const HOURS = Array.from({ length: 15 }, (_, index) => 7 + index);

/** The 105 slots of GET /slots, all free except the ones in `changes`, keyed by "date hour". */
function week(changes: Record<string, Partial<SlotView>> = {}): SlotView[] {
  return DATES.flatMap((date) => HOURS.map((hour) => makeSlot({ date, hour, ...changes[`${date} ${hour}`] })));
}

const token = makeToken();
const bobToken = makeToken({ email: 'bob.durand@castelmont.fr' });

const isBob = (request: Request) => request.headers.get('Authorization') === `Bearer ${bobToken}`;

function rowOf(hours: string): HTMLElement {
  return screen.getByText(hours).closest('li')!;
}

describe('PlanningPage, the slots', () => {
  it('shows a loading status, then the planning', async () => {
    fakeApi({ 'GET /slots': () => Response.json(week()) });
    renderApp('/', { token });

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(await screen.findByText('07:00 – 08:00')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the seven days, the first one selected', async () => {
    fakeApi({ 'GET /slots': () => Response.json(week()) });
    renderApp('/', { token });

    await screen.findByText('07:00 – 08:00');
    DAY_LABELS.forEach((label, index) => {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', String(index === 0));
    });
  });

  it('lists the 15 slots of the selected day, from 07:00 to 22:00, with their places', async () => {
    fakeApi({ 'GET /slots': () => Response.json(week()) });
    renderApp('/', { token });

    await screen.findByText('07:00 – 08:00');
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(15);
    expect(rows[0]).toHaveTextContent('07:00 – 08:00');
    expect(rows[14]).toHaveTextContent('21:00 – 22:00');
    expect(within(rows[0]).getByText('12 places restantes')).toBeInTheDocument();
  });

  it('offers to join the waiting list of a full slot', async () => {
    fakeApi({ 'GET /slots': () => Response.json(week({ '2026-10-21 18': { remaining: 0, waitingCount: 1 } })) });
    renderApp('/', { token });

    await screen.findByText('18:00 – 19:00');
    expect(within(rowOf('18:00 – 19:00')).getByRole('button', { name: "Rejoindre la liste d'attente" })).toBeInTheDocument();
    expect(within(rowOf('17:00 – 18:00')).getByRole('button', { name: "S'inscrire" })).toBeInTheDocument();
  });

  it('shows the slots of another day on a click on its tab', async () => {
    fakeApi({ 'GET /slots': () => Response.json(week({ '2026-10-22 18': { remaining: 4 } })) });
    renderApp('/', { token });
    await screen.findByText('07:00 – 08:00');
    expect(screen.queryByText('4 places restantes')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'jeu. 22/10' }));

    expect(screen.getByRole('button', { name: 'jeu. 22/10' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'mer. 21/10' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(rowOf('18:00 – 19:00')).getByText('4 places restantes')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(15);
  });

  it('asks for the slots with the token', async () => {
    const requests = fakeApi({ 'GET /slots': () => Response.json(week()) });
    renderApp('/', { token });

    await screen.findByText('07:00 – 08:00');
    const slots = requests.find((request) => request.method === 'GET' && pathOf(request) === '/slots');
    expect(slots?.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('says so when the planning cannot be loaded', async () => {
    fakeApi({ 'GET /slots': () => nestError(500, 'Internal server error') });
    renderApp('/', { token });

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger le planning');
  });

  it('never shows the slots of the previous account after a change of account', async () => {
    fakeApi({
      'GET /auth/me': (request) => Response.json(isBob(request) ? bob : alice),
      'GET /slots': (request) =>
        isBob(request)
          ? new Promise<Response>(() => {})
          : Response.json(week({ '2026-10-21 18': { remaining: 11, myStatus: 'confirmed', myRegistrationId: 'r1' } })),
      'POST /auth/login': () => Response.json({ access_token: bobToken }),
    });
    renderApp('/', { token });
    expect(await screen.findByText('Inscrit')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await userEvent.type(screen.getByLabelText('Email'), 'bob.durand@castelmont.fr');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'salle-de-sport');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('heading', { name: 'Planning' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(screen.queryByText('Inscrit')).not.toBeInTheDocument();
  });
});

describe('PlanningPage, the initiation', () => {
  const notice = "Votre initiation n'est pas encore validée. Contactez un référent pour la faire : vous pourrez ensuite réserver.";

  it('lets a student whose initiation is validated book, without the notice', async () => {
    fakeApi({ 'GET /slots': () => Response.json(week()) });
    renderApp('/', { token });

    await screen.findByText('Alice Martin');
    await screen.findByText('07:00 – 08:00');
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
    screen.getAllByRole('button', { name: "S'inscrire" }).forEach((button) => expect(button).toBeEnabled());
  });

  it('tells a student without initiation to see a referent, and disables the buttons', async () => {
    fakeApi({ 'GET /auth/me': () => Response.json(bob), 'GET /slots': () => Response.json(week()) });
    renderApp('/', { token: bobToken });

    expect(await screen.findByText(notice)).toBeInTheDocument();
    await screen.findByText('07:00 – 08:00');
    screen.getAllByRole('button', { name: "S'inscrire" }).forEach((button) => expect(button).toBeDisabled());
  });

  it('disables the buttons until the profile has arrived', async () => {
    fakeApi({ 'GET /auth/me': () => new Promise<Response>(() => {}), 'GET /slots': () => Response.json(week()) });
    renderApp('/', { token });

    await screen.findByText('07:00 – 08:00');
    screen.getAllByRole('button', { name: "S'inscrire" }).forEach((button) => expect(button).toBeDisabled());
  });
});
