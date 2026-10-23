/** A place in the slot, or a place in its waiting list. */
export type RegistrationStatus = 'confirmed' | 'waiting';

/** Every status, for the Swagger enums. */
export const REGISTRATION_STATUSES: RegistrationStatus[] = ['confirmed', 'waiting'];

/** A registration, as its owner sees it. */
export interface Registration {
  id: string;
  /** `YYYY-MM-DD`, Paris time. */
  date: string;
  /** From 7 to 21: the slot runs from `hour:00` to `hour+1:00`. */
  hour: number;
  status: RegistrationStatus;
  /** Place in the waiting list, 1 for the first; only when `status` is `waiting`. */
  position?: number;
  /** Start of the slot, ISO 8601 in UTC. */
  startsAt: string;
}

/** A registered user, as the referents see them. */
export interface Person {
  firstName: string;
  lastName: string;
  email: string;
}

/** Who registered to a slot, as the referents see it. */
export interface SlotRegistrations {
  /** The holders of a place, in order of arrival. */
  confirmed: Person[];
  /** The waiting list, first in line first; `position` is 1 for the first. */
  waiting: (Person & { position: number })[];
}

// The messages are in French: the web app shows them as they are.

/** Thrown by the booking when no referent has validated the user's initiation yet. */
export class InitiationRequired extends Error {
  constructor() {
    super("Votre initiation n'a pas encore été validée par un référent.");
  }
}

/** Thrown by the booking for a slot that has started, or that is outside the visible days or the opening hours. */
export class SlotNotBookable extends Error {
  constructor() {
    super("Ce créneau n'est plus disponible.");
  }
}

/** Thrown by the booking when the user already holds this slot, or a place in its waiting list. */
export class AlreadyRegistered extends Error {
  constructor() {
    super('Vous êtes déjà inscrit à ce créneau.');
  }
}

/** Thrown by the booking when the user already holds two slots that day, waiting lists included. */
export class DailyLimitReached extends Error {
  constructor() {
    super("Deux créneaux par jour maximum, liste d'attente comprise.");
  }
}

/** Thrown by the cancellation when no registration has this id, for instance once it has been cancelled. */
export class RegistrationNotFound extends Error {
  constructor() {
    super('Inscription introuvable.');
  }
}

/** Thrown by the cancellation when the registration belongs to another user. */
export class NotYourRegistration extends Error {
  constructor() {
    super('Cette inscription ne vous appartient pas.');
  }
}

/** Thrown by the cancellation less than an hour before the slot, waiting list included. */
export class CancellationTooLate extends Error {
  constructor() {
    super("Désinscription possible jusqu'à une heure avant le créneau.");
  }
}
