import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ApiError, fetchSlotPeople } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { formatDay, formatHour } from '../format';
import type { Person } from '../types';

interface PeopleProps {
  id: string;
  title: string;
  people: Person[];
  empty: string;
}

const People = ({ id, title, people, empty }: PeopleProps) => (
  <>
    <h3 id={id}>{title}</h3>
    {people.length === 0 ? (
      <p className="empty">{empty}</p>
    ) : (
      <ol className="people" aria-labelledby={id}>
        {people.map((person) => (
          <li key={person.email}>{`${person.firstName} ${person.lastName}`}</li>
        ))}
      </ol>
    )}
  </>
);

/** Who registered to a slot, at /referent/slots/:date/:hour. */
export const ReferentSlotPage = () => {
  // On this route, both are always there: the `as` is a promise made to the compiler.
  const { date, hour } = useParams() as { date: string; hour: string };
  const { token } = useAuth();

  const { data, error, isPending, isError } = useQuery({
    queryKey: ['slot-registrations', token, date, hour],
    queryFn: () => fetchSlotPeople(date, hour, token!),
  });

  return (
    <section className="page">
      <Link className="back" to="/">
        ← Retour au planning
      </Link>

      {isPending && (
        <p className="status" role="status">
          Chargement…
        </p>
      )}
      {isError && (
        <div className="error" role="alert">
          <span>
            {error instanceof ApiError && [400, 404].includes(error.status)
              ? 'Créneau introuvable.'
              : `Impossible de charger les inscrits : ${error.message}`}
          </span>
        </div>
      )}
      {data && (
        <>
          {/* Formatted only once the API has accepted the address: formatDay throws on a malformed date. */}
          <h2>{`${formatDay(date)} · ${formatHour(Number(hour))}`}</h2>
          <People id="confirmed" title="Inscrits" people={data.confirmed} empty="Aucun inscrit." />
          <People id="waiting" title="Liste d'attente" people={data.waiting} empty="Personne en attente." />
        </>
      )}
    </section>
  );
};
