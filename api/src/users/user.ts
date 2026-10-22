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

/** Thrown when no account has the given id. */
export class UserNotFound extends Error {
  constructor(id: string) {
    super(`User ${id} not found`);
  }
}
