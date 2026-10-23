// The same shapes as the DTOs of the API.

export type Role = 'student' | 'referent';

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  initiationValidated: boolean;
}

export interface NewAccount {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export type RegistrationStatus = 'confirmed' | 'waiting';

/** A slot of GET /slots: counts only, plus the user's own registration when there is one. */
export interface SlotView {
  /** `YYYY-MM-DD`, Paris time. */
  date: string;
  /** From 7 to 21: the slot runs from `hour:00` to `hour+1:00`. */
  hour: number;
  /** ISO 8601, UTC. */
  startsAt: string;
  remaining: number;
  waitingCount: number;
  isPast: boolean;
  myStatus?: RegistrationStatus;
  /** 1 for the first in the waiting list. */
  myPosition?: number;
  myRegistrationId?: string;
}

/** A student of GET /users, as the referents see them. */
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  initiationValidated: boolean;
  /** ISO 8601, UTC. Absent until a referent validates the initiation. */
  initiationValidatedAt?: string;
}

/** Someone registered to a slot, as the referents see them. */
export interface Person {
  firstName: string;
  lastName: string;
  email: string;
}

export interface WaitingPerson extends Person {
  /** 1 for the first in the waiting list. */
  position: number;
}

/** GET /slots/:date/:hour/registrations: both lists in order of arrival. */
export interface SlotRegistrations {
  confirmed: Person[];
  waiting: WaitingPerson[];
}

/** A registration of GET /registrations/me. */
export interface Registration {
  id: string;
  /** `YYYY-MM-DD`, Paris time. */
  date: string;
  hour: number;
  status: RegistrationStatus;
  /** 1 for the first in the waiting list. */
  position?: number;
  /** ISO 8601, UTC. */
  startsAt: string;
}
