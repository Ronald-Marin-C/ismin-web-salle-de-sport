// The messages are in French: the web app shows them as they are.

/** Thrown by the registration when the email does not belong to the school domain. */
export class EmailNotFromSchool extends Error {
  constructor(domain: string) {
    super(`Utilisez votre email de l'école (@${domain}).`);
  }
}

/** Thrown by the registration when an account already uses this email. */
export class EmailAlreadyUsed extends Error {
  constructor() {
    super('Cet email est déjà utilisé.');
  }
}

/**
 * Thrown by the login for an unknown email as well as for a wrong password:
 * one error for both, so that the answer does not reveal which emails have an account.
 */
export class InvalidCredentials extends Error {
  constructor() {
    super('Email ou mot de passe incorrect.');
  }
}
