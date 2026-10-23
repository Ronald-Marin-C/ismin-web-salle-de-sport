import type { RegistrationStatus } from './types';

/** "2026-10-21" → "mer. 21/10" */
export function formatDay(date: string): string {
  // Built from its parts: new Date('2026-10-21') is midnight UTC, still the 20th west of Greenwich.
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** 7 → "07:00 – 08:00": a slot lasts one hour. */
export function formatHour(hour: number): string {
  return `${clock(hour)} – ${clock(hour + 1)}`;
}

/** "Inscrit", or the place in the waiting list: "En attente (n°2)". */
export function formatStatus(status: RegistrationStatus, position?: number): string {
  return status === 'confirmed' ? 'Inscrit' : `En attente (n°${position})`;
}
