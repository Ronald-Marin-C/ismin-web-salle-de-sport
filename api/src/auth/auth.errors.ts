/**
 * Thrown by the login for an unknown email as well as for a wrong password:
 * one error for both, so that the answer does not reveal which emails have an account.
 */
export class InvalidCredentials extends Error {
  constructor() {
    super('Wrong email or password');
  }
}
