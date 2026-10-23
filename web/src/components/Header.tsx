import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useMe } from '../auth/useMe';

/** The top of every page: the title and the navigation. */
export const Header = () => {
  const { user, logout } = useAuth();
  const { data: me } = useMe();

  return (
    <header className="app-header">
      <div>
        <h1 className="app-title">
          <Link to="/">Salle de sport</Link>
        </h1>
        <p className="app-tagline">Réservez votre créneau à la salle de muscu</p>
      </div>

      <nav className="app-nav" aria-label="Navigation principale">
        {user ? (
          <>
            <Link to="/">Planning</Link>
            <Link to="/my-registrations">Mes créneaux</Link>
            {user.role === 'referent' && <Link to="/referent/initiations">Initiations</Link>}
            {me &&<span className="app-user">{`${me.firstName} ${me.lastName}`}</span>}
            <button className="link-button" type="button" onClick={logout}>
              Se déconnecter
            </button>
          </>
        ) : (
          <Link to="/login">Se connecter</Link>
        )}
      </nav>
    </header>
  );
};
