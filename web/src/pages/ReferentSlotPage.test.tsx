import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, makeSlot, makeToken, nestError, pathOf, referent, referentToken, renderApp } from '../test-utils';
import type { Person, SlotRegistrations } from '../types';

const token = referentToken();

const person = (firstName: string, lastName: string): Person => ({
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@castelmont.fr`,
});

const people: SlotRegistrations = {
  confirmed: [person('Alice', 'Martin'), person('Bob', 'Durand'), person('Chloé', 'Petit')],
  waiting: [
    { ...person('David', 'Roux'), position: 1 },
    { ...person('Emma', 'Blanc'), position: 2 },
  ],
};

const nobody: SlotRegistrations = { confirmed: [], waiting: [] };

/** The fake API, with referent1 as the logged-in user. */
function fakeReferentApi(routes: Parameters<typeof fakeApi>[0]): Request[] {
  return fakeApi({ 'GET /auth/me': () => Response.json(referent), ...routes });
}

const planning = [
  makeSlot({ date: '2026-10-21', hour: 18 }),
  makeSlot({ date: '2026-10-21', hour: 19 }),
  makeSlot({ date: '2026-10-22', hour: 18 }),
];

/** From the planning, opens the list of the slot of the selected day at `hours`. */
async function openPeopleOf(hours: string) {
  const row = (await screen.findByText(hours)).closest('li')!;
  await userEvent.click(within(row).getByRole('link', { name: 'Voir les inscrits' }));
}

const namesIn = (list: string) =>
  within(screen.getByRole('list', { name: list }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('ReferentSlotPage', () => {
  it('shows the day and the hours of the slot', async () => {
    fakeReferentApi({ 'GET /slots/2026-10-21/18/registrations': () => Response.json(people) });
    renderApp('/referent/slots/2026-10-21/18', { token });

    expect(await screen.findByRole('heading', { name: 'mer. 21/10 · 18:00 – 19:00' })).toBeInTheDocument();
  });

  it('asks for the people with GET /slots/:date/:hour/registrations and the token', async () => {
    const requests = fakeReferentApi({ 'GET /slots/2026-10-21/18/registrations': () => Response.json(people) });
    renderApp('/referent/slots/2026-10-21/18', { token });

    await screen.findByText('Alice Martin');
    const request = requests.find((request) => pathOf(request) === '/slots/2026-10-21/18/registrations');
    expect(request?.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('lists the holders of a place, then the waiting list, both in order', async () => {
    fakeReferentApi({ 'GET /slots/2026-10-21/18/registrations': () => Response.json(people) });
    renderApp('/referent/slots/2026-10-21/18', { token });

    await screen.findByText('Alice Martin');
    expect(namesIn('Inscrits')).toEqual(['Alice Martin', 'Bob Durand', 'Chloé Petit']);
    expect(namesIn("Liste d'attente")).toEqual(['David Roux', 'Emma Blanc']);
  });

  it('says so when nobody registered', async () => {
    fakeReferentApi({ 'GET /slots/2026-10-21/18/registrations': () => Response.json(nobody) });
    renderApp('/referent/slots/2026-10-21/18', { token });

    expect(await screen.findByText('Aucun inscrit.')).toBeInTheDocument();
    expect(screen.getByText('Personne en attente.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Inscrits' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: "Liste d'attente" })).not.toBeInTheDocument();
  });

  it('says so when only the waiting list is empty', async () => {
    fakeReferentApi({
      'GET /slots/2026-10-21/18/registrations': () => Response.json({ ...people, waiting: [] }),
    });
    renderApp('/referent/slots/2026-10-21/18', { token });

    await screen.findByText('Alice Martin');
    expect(screen.getByText('Personne en attente.')).toBeInTheDocument();
    expect(screen.queryByText('Aucun inscrit.')).not.toBeInTheDocument();
  });

  it('shows a loading status, then the people', async () => {
    let answer: (response: Response) => void = () => {};
    fakeReferentApi({
      'GET /slots/2026-10-21/18/registrations': () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    renderApp('/referent/slots/2026-10-21/18', { token });

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    answer(Response.json(people));
    expect(await screen.findByText('Alice Martin')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the slot does not exist for a malformed address, without breaking the page', async () => {
    fakeReferentApi({
      'GET /slots/foo/18/registrations': () => nestError(400, ['date must match /^\\d{4}-\\d{2}-\\d{2}$/ regular expression']),
    });
    renderApp('/referent/slots/foo/18', { token });

    expect(await screen.findByRole('alert')).toHaveTextContent('Créneau introuvable.');
    expect(screen.getByRole('link', { name: '← Retour au planning' })).toBeInTheDocument();
  });

  it('says the slot does not exist for a well-formed address the API does not know', async () => {
    fakeReferentApi({ 'GET /slots/2026-13-45/18/registrations': () => nestError(404, 'Créneau introuvable.') });
    renderApp('/referent/slots/2026-13-45/18', { token });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Créneau introuvable.');
    expect(alert).not.toHaveTextContent('Impossible de charger les inscrits');
  });

  it('encodes the date and the hour in the path of the request', async () => {
    const requests = fakeReferentApi({
      'GET /slots/a%2Fb/18/registrations': () => nestError(400, ['date must match /^\\d{4}-\\d{2}-\\d{2}$/ regular expression']),
    });
    renderApp('/referent/slots/a%2Fb/18', { token });

    expect(await screen.findByRole('alert')).toHaveTextContent('Créneau introuvable.');
    expect(requests.map(pathOf)).toContain('/slots/a%2Fb/18/registrations');
  });

  it('encodes the hour too', async () => {
    const requests = fakeReferentApi({
      'GET /slots/2026-10-21/1%3F8/registrations': () => nestError(400, ['hour must be an integer number']),
    });
    renderApp('/referent/slots/2026-10-21/1%3F8', { token });

    expect(await screen.findByRole('alert')).toHaveTextContent('Créneau introuvable.');
    expect(requests.map(pathOf)).toContain('/slots/2026-10-21/1%3F8/registrations');
  });

  it('never shows the people of the slot seen before, at another hour of the day', async () => {
    fakeReferentApi({
      'GET /slots': () => Response.json(planning),
      'GET /slots/2026-10-21/18/registrations': () => Response.json(people),
      'GET /slots/2026-10-21/19/registrations': () => new Promise<Response>(() => {}),
    });
    renderApp('/referent/slots/2026-10-21/18', { token });
    await screen.findByText('Alice Martin');

    await userEvent.click(screen.getByRole('link', { name: '← Retour au planning' }));
    await openPeopleOf('19:00 – 20:00');

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument();
  });

  it('never shows the people of the slot seen before, at the same hour of another day', async () => {
    fakeReferentApi({
      'GET /slots': () => Response.json(planning),
      'GET /slots/2026-10-21/18/registrations': () => Response.json(people),
      'GET /slots/2026-10-22/18/registrations': () => new Promise<Response>(() => {}),
    });
    renderApp('/referent/slots/2026-10-21/18', { token });
    await screen.findByText('Alice Martin');

    await userEvent.click(screen.getByRole('link', { name: '← Retour au planning' }));
    await userEvent.click(await screen.findByRole('button', { name: 'jeu. 22/10' }));
    await openPeopleOf('18:00 – 19:00');

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument();
  });

  it('says so when the people cannot be loaded', async () => {
    fakeReferentApi({ 'GET /slots/2026-10-21/18/registrations': () => nestError(500, 'Internal server error') });
    renderApp('/referent/slots/2026-10-21/18', { token });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Impossible de charger les inscrits : L'API a répondu 500",
    );
  });

  it('goes back to the planning', async () => {
    fakeReferentApi({ 'GET /slots/2026-10-21/18/registrations': () => Response.json(people) });
    renderApp('/referent/slots/2026-10-21/18', { token });
    await screen.findByText('Alice Martin');

    await userEvent.click(screen.getByRole('link', { name: '← Retour au planning' }));

    expect(screen.getByRole('heading', { name: 'Planning' })).toBeInTheDocument();
  });

  it('shows a student the notice instead of the page', async () => {
    renderApp('/referent/slots/2026-10-21/18', { token: makeToken() });

    expect(await screen.findByText('Page réservée aux référents.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '← Retour au planning' })).not.toBeInTheDocument();
  });

  it('sends a logged-out visitor to the login page', () => {
    renderApp('/referent/slots/2026-10-21/18');

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });
});
