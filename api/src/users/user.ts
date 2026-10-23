/** The two roles. Registration only creates students; the referents come from the seed. */
export type Role = 'student' | 'referent';

/** Every role, for the Swagger enums. */
export const ROLES: Role[] = ['student', 'referent'];

/** An account, without its password hash. */
export interface User {
  id: string;
  /** Always lowercase. */
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  /** When a referent validated the initiation; absent until then. */
  initiationValidatedAt?: Date;
  /** Id of the referent who validated the initiation. */
  initiationValidatedBy?: string;
}

/** A student as the referents see them, to validate their initiation. */
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  initiationValidated: boolean;
  /** When a referent validated the initiation; absent until then. */
  initiationValidatedAt?: Date;
}

/** Thrown when no account has the given id. The message is in French: the web app shows it as it is. */
export class UserNotFound extends Error {
  constructor() {
    super('Compte introuvable.');
  }
}
