import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthProvider';
import type { NewAccount } from '../types';

const EMPTY_ACCOUNT: NewAccount = { firstName: '', lastName: '', email: '', password: '' };

/** The page to create a student account, at /register. */
export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [account, setAccount] = useState(EMPTY_ACCOUNT);
  const [error, setError] = useState('');

  const update = (field: keyof NewAccount) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setAccount((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await register(account);
      navigate('/', { replace: true });
    } catch (err) {
      // The fields already enforce the limits of the API, so a 400 or a 409
      // carries one of its own messages, in French.
      setError(
        err instanceof ApiError && (err.status === 400 || err.status === 409)
          ? err.details.join(' ')
          : `Création du compte impossible : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <section className="page form-page">
      <h2>Créer un compte</h2>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="register-first-name">Prénom</label>
          <input
            id="register-first-name"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={50}
            value={account.firstName}
            onChange={update('firstName')}
          />
        </div>

        <div className="field">
          <label htmlFor="register-last-name">Nom</label>
          <input
            id="register-last-name"
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={50}
            value={account.lastName}
            onChange={update('lastName')}
          />
        </div>

        <div className="field">
          <label htmlFor="register-email">Email de l'école</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={account.email}
            onChange={update('email')}
          />
        </div>

        <div className="field">
          <label htmlFor="register-password">Mot de passe</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            aria-describedby="register-password-hint"
            value={account.password}
            onChange={update('password')}
          />
          <p className="field-hint" id="register-password-hint">
            8 caractères minimum
          </p>
        </div>

        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <button className="button" type="submit">
          Créer mon compte
        </button>
      </form>
    </section>
  );
};
