/** Thrown by the registration when the email does not belong to the school domain. */
export class EmailNotFromSchool extends Error {
  constructor(domain: string) {
    super(`Use your school email (@${domain})`);
  }
}

/** Thrown by the registration when an account already uses this email. */
export class EmailAlreadyUsed extends Error {
  constructor(email: string) {
    super(`An account already uses ${email}`);
  }
}

/**
 * Thrown by the login for an unknown email as well as for a wrong password:
 * one error for both, so that the answer does not reveal which emails have an account.
 */
export class InvalidCredentials extends Error {
  constructor() {
    super('Wrong email or password');
  }
}
