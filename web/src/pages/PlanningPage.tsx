import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchSlots } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { useMe } from '../auth/useMe';
import { DayTabs } from '../components/DayTabs';
import { InitiationBanner } from '../components/InitiationBanner';
import { SlotRow } from '../components/SlotRow';

/** The slots of the next seven days, at /, one day at a time. */
export const PlanningPage = () => {
  const { token } = useAuth();
  const { data: me } = useMe();
  const [selected, setSelected] = useState<string>();

  const { data: slots, error, isPending, isError } = useQuery({
    // The token is in the key, as for ['me', token]: the next account never sees the registrations of the previous one.
    queryKey: ['slots', token],
    queryFn: () => fetchSlots(token!),
  });

  // The days come from the API, in its order: today first, in Paris time.
  const dates = [...new Set(slots?.map((slot) => slot.date))];
  const day = selected ?? dates[0];
  const canBook = me?.initiationValidated === true;

  return (
    <section className="page">
      <h2>Planning</h2>

      <InitiationBanner me={me} />

      {isPending && (
        <p className="status" role="status">
          Chargement…
        </p>
      )}
      {isError && (
        <div className="error" role="alert">
          <span>Impossible de charger le planning : {error.message}</span>
        </div>
      )}
      {slots && (
        <>
          <DayTabs dates={dates} selected={day} onSelect={setSelected} />
          <ul className="slot-list">
            {slots
              .filter((slot) => slot.date === day)
              .map((slot) => (
                <li key={slot.hour}>
                  <SlotRow slot={slot} canBook={canBook} onBook={() => {}} />
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
};
