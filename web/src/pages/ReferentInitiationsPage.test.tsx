import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TOKEN_KEY } from '../auth/AuthProvider';
import {
  fakeApi,
  makeStudent,
  makeToken,
  nestError,
  pathOf,
  referent,
  referentToken,
  renderApp,
} from '../test-utils';
import type { Student } from '../types';

const token = referentToken();

const validated: Partial<Student> = { initiationValidated: true, initiationValidatedAt: '2026-10-21T08:30:00.000Z' };

const alice = makeStudent({
  id: 'u1',
  firstName: 'Alice',
  lastName: 'Martin',
  email: 'alice.martin@castelmont.fr',
  ...validated,
});

const chloe = makeStudent({ id: 'u4', firstName: 'Chloé', lastName: 'Petit', email: 'chloe.petit@castelmont.fr' });

/** The fake API, with referent1 as the logged-in user. */
function fakeReferentApi(routes: Parameters<typeof fakeApi>[0]): Request[] {
  return fakeApi({ 'GET /auth/me': () => Response.json(referent), ...routes });
}

function openPage() {
  renderApp('/referent/initiations', { token });
}

/** Types `text` in the search field, then sends the form. */
async function search(text: string) {
  if (text) await userEvent.type(screen.getByLabelText('Rechercher un élève'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('li')!;
}

function validateButtonOf(name: string): HTMLElement {
  return within(rowOf(name)).getByRole('button', { name: "Valider l'initiation" });
}

const usersRequests = (requests: Request[]) => requests.filter((request) => new URL(request.url).pathname === '/users');

describe('ReferentInitiationsPage, the search', () => {
  it('opens from the header', async () => {
    fakeReferentApi({});
    renderApp('/', { token });

    await userEvent.click(screen.getByRole('link', { name: 'Initiations' }));

    expect(screen.getByRole('heading', { name: 'Initiations' })).toBeInTheDocument();
  });

  it('asks for nothing before the first search', async () => {
    const requests = fakeReferentApi({});
    openPage();

    await screen.findByText('Référent 1');
    expect(usersRequests(requests)).toHaveLength(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('limits the search to 100 characters, as the API', () => {
    fakeReferentApi({});
    openPage();

    expect(screen.getByLabelText('Rechercher un élève')).toHaveAttribute('maxlength', '100');
  });

  it('searches the students with GET /users?search= and the token', async () => {
    const requests = fakeReferentApi({ 'GET /users?search=durand': () => Response.json([makeStudent()]) });
    openPage();

    await search('durand');

    expect(await screen.findByText('Bob Durand')).toBeInTheDocument();
    const [request] = usersRequests(requests);
    expect(pathOf(request)).toBe('/users?search=durand');
    expect(request.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('searches on Enter too', async () => {
    fakeReferentApi({ 'GET /users?search=durand': () => Response.json([makeStudent()]) });
    openPage();

    await userEvent.type(screen.getByLabelText('Rechercher un élève'), 'durand{Enter}');

    expect(await screen.findByText('Bob Durand')).toBeInTheDocument();
  });

  it('removes the spaces around the search', async () => {
    const requests = fakeReferentApi({ 'GET /users?search=durand': () => Response.json([makeStudent()]) });
    openPage();

    await search('  durand  ');

    expect(await screen.findByText('Bob Durand')).toBeInTheDocument();
    expect(pathOf(usersRequests(requests)[0])).toBe('/users?search=durand');
  });

  it('encodes the search in the URL', async () => {
    const requests = fakeReferentApi({
      'GET /users?search=dur%26role%3Dreferent': () => Response.json([makeStudent()]),
    });
    openPage();

    await search('dur&role=referent');

    expect(await screen.findByText('Bob Durand')).toBeInTheDocument();
    expect(pathOf(usersRequests(requests)[0])).toBe('/users?search=dur%26role%3Dreferent');
  });

  it('lists every student for an empty search', async () => {
    const requests = fakeReferentApi({ 'GET /users?search=': () => Response.json([makeStudent(), alice]) });
    openPage();

    await search('');

    expect(await screen.findByText('Bob Durand')).toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(pathOf(usersRequests(requests)[0])).toBe('/users?search=');
  });

  it('shows the students of a new search', async () => {
    fakeReferentApi({
      'GET /users?search=durand': () => Response.json([makeStudent()]),
      'GET /users?search=martin': () => Response.json([alice]),
    });
    openPage();
    await search('durand');
    await screen.findByText('Bob Durand');

    await userEvent.clear(screen.getByLabelText('Rechercher un élève'));
    await search('martin');

    expect(await screen.findByText('Alice Martin')).toBeInTheDocument();
    expect(screen.queryByText('Bob Durand')).not.toBeInTheDocument();
  });

  it('shows a loading status, then the students', async () => {
    let answer: (response: Response) => void = () => {};
    fakeReferentApi({ 'GET /users?search=durand': () => new Promise<Response>((resolve) => (answer = resolve)) });
    openPage();

    await search('durand');

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    answer(Response.json([makeStudent()]));
    expect(await screen.findByText('Bob Durand')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the name, the email and the initiation of each student', async () => {
    fakeReferentApi({ 'GET /users?search=': () => Response.json([makeStudent(), alice]) });
    openPage();

    await search('');

    await screen.findByText('Bob Durand');
    const bobRow = rowOf('Bob Durand');
    expect(bobRow).toHaveTextContent('bob.durand@castelmont.fr');
    expect(validateButtonOf('Bob Durand')).toBeEnabled();
    expect(within(bobRow).queryByText(/Initiation validée/)).not.toBeInTheDocument();

    const aliceRow = rowOf('Alice Martin');
    expect(aliceRow).toHaveTextContent('alice.martin@castelmont.fr');
    expect(within(aliceRow).getByText('Initiation validée le 21/10')).toBeInTheDocument();
    expect(within(aliceRow).queryByRole('button')).not.toBeInTheDocument();
  });

  it('says so when no student matches', async () => {
    fakeReferentApi({ 'GET /users?search=zorro': () => Response.json([]) });
    openPage();

    await search('zorro');

    expect(await screen.findByText('Aucun élève ne correspond à cette recherche.')).toBeInTheDocument();
  });

  it('asks to refine the search when 50 students come back, the most the API returns', async () => {
    const students = Array.from({ length: 50 }, (_, index) => makeStudent({ id: `s${index}`, lastName: `N${index}` }));
    fakeReferentApi({ 'GET /users?search=': () => Response.json(students) });
    openPage();

    await search('');

    expect(await screen.findByText('Bob N49')).toBeInTheDocument();
    expect(screen.getByText('50 élèves affichés au maximum : précisez la recherche.')).toBeInTheDocument();
  });

  it('does not ask to refine the search for 49 students', async () => {
    const students = Array.from({ length: 49 }, (_, index) => makeStudent({ id: `s${index}`, lastName: `N${index}` }));
    fakeReferentApi({ 'GET /users?search=': () => Response.json(students) });
    openPage();

    await search('');

    expect(await screen.findByText('Bob N48')).toBeInTheDocument();
    expect(screen.queryByText(/précisez la recherche/)).not.toBeInTheDocument();
  });

  it('says so when the search fails', async () => {
    fakeReferentApi({ 'GET /users?search=durand': () => nestError(500, 'Internal server error') });
    openPage();

    await search('durand');

    expect(await screen.findByRole('alert')).toHaveTextContent("Impossible de charger les élèves : L'API a répondu 500");
  });
});

describe('ReferentInitiationsPage, the validation', () => {
  it('validates an initiation with PATCH /users/:id/initiation and the token, then shows it', async () => {
    let done = false;
    const requests = fakeReferentApi({
      'GET /users?search=durand': () => Response.json([makeStudent(done ? validated : {})]),
      'PATCH /users/u2/initiation': () => {
        done = true;
        return Response.json(makeStudent(validated));
      },
    });
    openPage();
    await search('durand');
    await screen.findByText('Bob Durand');

    await userEvent.click(validateButtonOf('Bob Durand'));

    expect(await within(rowOf('Bob Durand')).findByText('Initiation validée le 21/10')).toBeInTheDocument();
    expect(within(rowOf('Bob Durand')).queryByRole('button')).not.toBeInTheDocument();
    const patch = requests.find((request) => request.method === 'PATCH');
    expect(pathOf(patch!)).toBe('/users/u2/initiation');
    expect(patch?.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('disables the buttons while a validation is being sent, then enables them again', async () => {
    let answer: (response: Response) => void = () => {};
    fakeReferentApi({
      'GET /users?search=': () => Response.json([makeStudent(), chloe]),
      'PATCH /users/u2/initiation': () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    openPage();
    await search('');
    await screen.findByText('Bob Durand');

    await userEvent.click(validateButtonOf('Bob Durand'));

    expect(validateButtonOf('Bob Durand')).toBeDisabled();
    expect(validateButtonOf('Chloé Petit')).toBeDisabled();
    answer(Response.json(makeStudent(validated)));
    await waitFor(() => expect(validateButtonOf('Chloé Petit')).toBeEnabled());
  });

  it('keeps the buttons disabled until the list shows the validation', async () => {
    let calls = 0;
    let release: () => void = () => {};
    fakeReferentApi({
      'GET /users?search=': async () => {
        const call = ++calls;
        if (call > 1) await new Promise<void>((resolve) => (release = resolve));
        return Response.json([makeStudent(call > 1 ? validated : {}), chloe]);
      },
      'PATCH /users/u2/initiation': () => Response.json(makeStudent(validated)),
    });
    openPage();
    await search('');
    await screen.findByText('Bob Durand');

    await userEvent.click(validateButtonOf('Bob Durand'));
    await waitFor(() => expect(calls).toBe(2));

    expect(validateButtonOf('Bob Durand')).toBeDisabled();
    expect(validateButtonOf('Chloé Petit')).toBeDisabled();
    release();
    expect(await within(rowOf('Bob Durand')).findByText('Initiation validée le 21/10')).toBeInTheDocument();
    expect(validateButtonOf('Chloé Petit')).toBeEnabled();
  });

  it('shows the message of the API when the account no longer exists', async () => {
    fakeReferentApi({
      'GET /users?search=durand': () => Response.json([makeStudent()]),
      'PATCH /users/u2/initiation': () => nestError(404, 'Compte introuvable.'),
    });
    openPage();
    await search('durand');
    await screen.findByText('Bob Durand');

    await userEvent.click(validateButtonOf('Bob Durand'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Compte introuvable.');
    expect(screen.getByRole('heading', { name: 'Initiations' })).toBeInTheDocument();
  });

  it('says so in French when the API fails, without its message', async () => {
    fakeReferentApi({
      'GET /users?search=durand': () => Response.json([makeStudent()]),
      'PATCH /users/u2/initiation': () => nestError(500, 'Internal server error'),
    });
    openPage();
    await search('durand');
    await screen.findByText('Bob Durand');

    await userEvent.click(validateButtonOf('Bob Durand'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Validation impossible : L'API a répondu 500");
    expect(alert).not.toHaveTextContent('Internal server error');
  });

  it('clears the error at the next validation', async () => {
    fakeReferentApi({
      'GET /users?search=': () => Response.json([makeStudent(), chloe]),
      'PATCH /users/u4/initiation': () => nestError(404, 'Compte introuvable.'),
      'PATCH /users/u2/initiation': () => Response.json(makeStudent(validated)),
    });
    openPage();
    await search('');
    await screen.findByText('Bob Durand');
    await userEvent.click(validateButtonOf('Chloé Petit'));
    await screen.findByRole('alert');

    await userEvent.click(validateButtonOf('Bob Durand'));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('logs out when the API refuses the token, and the login page says the session ended', async () => {
    fakeReferentApi({
      'GET /users?search=durand': () => Response.json([makeStudent()]),
      'PATCH /users/u2/initiation': () => nestError(401, 'Invalid or expired token'),
    });
    openPage();
    await search('durand');
    await screen.findByText('Bob Durand');

    await userEvent.click(validateButtonOf('Bob Durand'));

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByText('Votre session a pris fin. Reconnectez-vous.')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe('ReferentInitiationsPage, the access', () => {
  it('shows a student the notice instead of the page', async () => {
    renderApp('/referent/initiations', { token: makeToken() });

    expect(await screen.findByText('Page réservée aux référents.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Initiations' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Rechercher un élève')).not.toBeInTheDocument();
  });

  it('sends a logged-out visitor to the login page', () => {
    renderApp('/referent/initiations');

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });
});
