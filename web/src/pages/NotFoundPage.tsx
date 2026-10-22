import { Link } from 'react-router';

/** Fallback page for any URL that matches no route (`*`). */
export const NotFoundPage = () => {
  return (
    <section className="page not-found">
      <h2>Page introuvable</h2>
      <p>Cette adresse ne correspond à aucune page de la salle de sport.</p>
      <Link to="/">Retour au planning</Link>
    </section>
  );
};
