import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, bookSlot, fetchSlots } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { useMe } from '../auth/useMe';
import { DayTabs } from '../components/DayTabs';
import { InitiationBanner } from '../components/InitiationBanner';
import { SlotRow } from '../components/SlotRow';
import type { SlotView } from '../types';

/** A 403, 409 or 422 carries a message of the API, in French: the initiation, a double booking, the daily limit… */
function describeBookingError(error: unknown): string {
  if (error instanceof ApiError && [403, 409, 422].includes(error.status)) return error.details.join(' ');
  return `Inscription impossible : ${error instanceof Error ? error.message : String(error)}`;
}

/** The slots of the next seven days, at /, one day at a time. */
export const PlanningPage = () => {
  const { token, user, endSession } = useAuth();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>();
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const { data: slots, error, isPending, isError } = useQuery({
    // The token is in the key, as for ['me', token]: the next account never sees the registrations of the previous one.
    queryKey: ['slots', token],
    queryFn: () => fetchSlots(token!),
  });

  // The days come from the API, in its order: today first, in Paris time.
  const dates = [...new Set(slots?.map((slot) => slot.date))];
  const day = selected ?? dates[0];
  const canBook = me?.initiationValidated === true && !booking;

  const book = async (slot: SlotView) => {
    setBooking(true);
    setBookingError('');
    try {
      await bookSlot(slot.date, slot.hour, token!);
      // Awaited: the buttons stay disabled until the planning shows the new registration.
      // Only ['slots']: with no staleTime, My registrations refetches its list whenever it opens.
      await queryClient.invalidateQueries({ queryKey: ['slots'] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        endSession();
        return;
      }
      setBookingError(describeBookingError(err));
    } finally {
      setBooking(false);
    }
  };

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
          {bookingError && (
            <div className="error" role="alert">
              <span>{bookingError}</span>
            </div>
          )}
          <ul className="slot-list">
            {slots
              .filter((slot) => slot.date === day)
              .map((slot) => (
                <li key={slot.hour}>
                  <SlotRow
                    slot={slot}
                    canBook={canBook}
                    isReferent={user?.role === 'referent'}
                    onBook={() => book(slot)}
                  />
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
};
