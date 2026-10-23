import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TOKEN_KEY } from '../auth/AuthProvider';
import { fakeApi, makeToken, nestError, pathOf, renderApp } from '../test-utils';

const chloe = {
  firstName: 'Chloé',
  lastName: 'Petit',
  email: 'chloe.petit@castelmont.fr',
  password: 'correct-horse',
};

const token = makeToken({ email: chloe.email });

async function fillAndSend() {
  await userEvent.type(screen.getByLabelText('Prénom'), chloe.firstName);
  await userEvent.type(screen.getByLabelText('Nom'), chloe.lastName);
  await userEvent.type(screen.getByLabelText("Email de l'école"), chloe.email);
  await userEvent.type(screen.getByLabelText('Mot de passe'), chloe.password);
  await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));
}

function stillOnThePage() {
  expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument();
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
}

describe('RegisterPage', () => {
  it('opens from the login page', async () => {
    renderApp('/login');

    await userEvent.click(screen.getByRole('link', { name: 'Créer un compte' }));

    expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument();
  });

  it('sends the four fields to POST /auth/register', async () => {
    const requests = fakeApi({ 'POST /auth/register': () => Response.json({ access_token: token }, { status: 201 }) });
    renderApp('/register');

    await fillAndSend();

    const register = requests.find((request) => request.method === 'POST' && pathOf(request) === '/auth/register');
    expect(register).toBeDefined();
    await expect(register!.json()).resolves.toEqual(chloe);
  });

  it('goes to the planning once the account is created, and keeps the token', async () => {
    fakeApi({ 'POST /auth/register': () => Response.json({ access_token: token }, { status: 201 }) });
    renderApp('/register');

    await fillAndSend();

    expect(await screen.findByRole('heading', { name: 'Planning' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
  });

  it('shows the message of the API when the email is already used', async () => {
    fakeApi({ 'POST /auth/register': () => nestError(409, 'Cet email est déjà utilisé.') });
    renderApp('/register');

    await fillAndSend();

    expect(await screen.findByRole('alert')).toHaveTextContent('Cet email est déjà utilisé.');
    stillOnThePage();
  });

  it('shows the message of the API for an email outside the school', async () => {
    fakeApi({ 'POST /auth/register': () => nestError(400, "Utilisez votre email de l'école (@castelmont.fr).") });
    renderApp('/register');

    await fillAndSend();

    expect(await screen.findByRole('alert')).toHaveTextContent("Utilisez votre email de l'école (@castelmont.fr).");
    stillOnThePage();
  });

  it('says so in French when the API fails, without its message', async () => {
    fakeApi({ 'POST /auth/register': () => nestError(500, 'Internal server error') });
    renderApp('/register');

    await fillAndSend();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Création du compte impossible');
    expect(alert).not.toHaveTextContent('Internal server error');
    stillOnThePage();
  });

  it('asks for the same limits as the API', () => {
    renderApp('/register');

    for (const label of ['Prénom', 'Nom']) {
      expect(screen.getByLabelText(label)).toBeRequired();
      expect(screen.getByLabelText(label)).toHaveAttribute('maxlength', '50');
    }
    expect(screen.getByLabelText("Email de l'école")).toBeRequired();
    expect(screen.getByLabelText("Email de l'école")).toHaveAttribute('type', 'email');
    const password = screen.getByLabelText('Mot de passe');
    expect(password).toBeRequired();
    expect(password).toHaveAttribute('minlength', '8');
    expect(password).toHaveAttribute('maxlength', '128');
    expect(password).toHaveAccessibleDescription('8 caractères minimum');
  });
});
