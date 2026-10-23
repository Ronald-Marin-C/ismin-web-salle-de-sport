import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, cancelRegistration, fetchMyRegistrations } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { formatDay, formatHour, formatStatus } from '../format';
import type { Registration } from '../types';

// The rule of the API: cancelling is possible until an hour before the slot.
const CANCEL_DEADLINE_MINUTES = 60;

function isCancellationClosed({ startsAt }: Registration): boolean {
  return new Date(startsAt).getTime() - Date.now() < CANCEL_DEADLINE_MINUTES * 60_000;
}

/** A 403, 404 or 422 carries a message of the API, in French. */
function describeCancellationError(error: unknown): string {
  if (error instanceof ApiError && [403, 404, 422].includes(error.status)) return error.details.join(' ');
  return `Désinscription impossible : ${error instanceof Error ? error.message : String(error)}`;
}

/** The user's registrations in the slots not over yet, at /my-registrations. */
export const MyRegistrationsPage = () => {
  const { token, endSession } = useAuth();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const { data: registrations, error, isPending, isError } = useQuery({
    // The token is in the key, as for ['me', token]: the next account never sees the registrations of the previous one.
    queryKey: ['my-registrations', token],
    queryFn: () => fetchMyRegistrations(token!),
  });

  const cancel = async (registration: Registration) => {
    setCancelling(true);
    setCancelError('');
    try {
      await cancelRegistration(registration.id, token!);
      // Awaited: the buttons stay disabled until the list no longer shows the registration.
      // Only ['my-registrations']: with no staleTime, the planning refetches its slots whenever it opens.
      await queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        endSession();
        return;
      }
      setCancelError(describeCancellationError(err));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="page">
      <h2>Mes créneaux</h2>

      {isPending && (
        <p className="status" role="status">
          Chargement…
        </p>
      )}
      {isError && (
        <div className="error" role="alert">
          <span>Impossible de charger vos créneaux : {error.message}</span>
        </div>
      )}
      {cancelError && (
        <div className="error" role="alert">
          <span>{cancelError}</span>
        </div>
      )}
      {registrations?.length === 0 && <p className="empty">Aucune réservation pour les 7 prochains jours.</p>}
      {registrations && registrations.length > 0 && (
        <ul className="slot-list">
          {registrations.map((registration) => {
            const closed = isCancellationClosed(registration);
            return (
              <li key={registration.id}>
                <div className="slot">
                  <span className="slot-day">{formatDay(registration.date)}</span>
                  <span className="slot-hours">{formatHour(registration.hour)}</span>
                  <span className="badge">{formatStatus(registration.status, registration.position)}</span>
                  {closed && <span className="slot-places">Désinscription fermée</span>}
                  <button
                    className="button"
                    type="button"
                    disabled={closed || cancelling}
                    onClick={() => cancel(registration)}
                  >
                    Se désinscrire
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
