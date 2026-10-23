import type { RegistrationStatus } from '../registrations/registration.js';

/**
 * A slot as one user sees it: counts only, never who registered, plus the
 * user's own registration when there is one.
 */
export interface SlotView {
  /** `YYYY-MM-DD`, Paris time. */
  date: string;
  /** From 7 to 21: the slot runs from `hour:00` to `hour+1:00`. */
  hour: number;
  /** Start of the slot, ISO 8601 in UTC. */
  startsAt: string;
  /** Places left. */
  remaining: number;
  /** Number of people in the waiting list. */
  waitingCount: number;
  /** Whether the slot has started. */
  isPast: boolean;
  /** The user's registration; absent when they are not registered. */
  myStatus?: RegistrationStatus;
  /** Place in the waiting list, 1 for the first; only when `myStatus` is `waiting`. */
  myPosition?: number;
  /** Id of the user's registration. */
  myRegistrationId?: string;
}
