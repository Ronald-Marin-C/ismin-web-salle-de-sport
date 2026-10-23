import { useState, type SubmitEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthProvider';

/** What RequireAuth leaves in the state of the navigation: the page that was asked for. */
interface FromState {
  from?: string;
}

/** The login page, at /login. */
export const LoginPage = () => {
  const { login, sessionEnded } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await login(email, password);
      // replace: the login page does not stay in the history.
      const from = (location.state as FromState | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Email ou mot de passe incorrect.'
          : `Connexion impossible : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <section className="page form-page">
      <h2>Connexion</h2>

      {sessionEnded && (
        <p className="notice" role="status">
          Votre session a pris fin. Reconnectez-vous.
        </p>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Mot de passe</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <button className="button" type="submit">
          Se connecter
        </button>
      </form>

      <p className="hint">
        Comptes de démonstration : referent1@castelmont.fr (référent) et alice.martin@castelmont.fr (élève), mot de
        passe salle-de-sport.
      </p>
    </section>
  );
};
