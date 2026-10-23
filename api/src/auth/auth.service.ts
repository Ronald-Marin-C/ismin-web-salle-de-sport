import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client.js';
import { UserNotFound, type User } from '../users/user.js';
import { UsersService } from '../users/users.service.js';
import { EmailAlreadyUsed, EmailNotFromSchool, InvalidCredentials } from './auth.errors.js';
import type { JwtPayload } from './auth.guard.js';
import type { MeDto } from './dto/me.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { hashPassword, verifyPassword } from './password.js';

/** Emails are stored lowercase, so that `Alice@…` and `alice@…` are the same account. */
function normalizeEmail(email: string): string {
  return email.toLowerCase();
}

/** Registration, login and profile. Signs the tokens; knows nothing about HTTP. */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Creates a student account. The email must end with `@` and the
   * `SCHOOL_EMAIL_DOMAIN` (default `castelmont.fr`).
   *
   * @returns An access token for the new account.
   * @throws EmailNotFromSchool when the email belongs to another domain.
   * @throws EmailAlreadyUsed when an account already uses this email, whatever its case.
   */
  async register(dto: RegisterDto): Promise<string> {
    const email = normalizeEmail(dto.email);
    const domain = process.env.SCHOOL_EMAIL_DOMAIN ?? 'castelmont.fr';
    if (!email.endsWith(`@${domain}`)) throw new EmailNotFromSchool(domain);

    let user: User;
    try {
      user = await this.users.createStudent({
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: hashPassword(dto.password),
      });
    } catch (error) {
      // No lookup beforehand: the unique index on email decides, which also
      // covers two registrations of the same email at the same instant.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new EmailAlreadyUsed(email);
      }
      throw error;
    }
    return this.signToken(user);
  }

  /**
   * Checks the credentials of an account.
   *
   * @returns An access token for this account.
   * @throws InvalidCredentials when the email is unknown or the password is wrong.
   */
  async login(email: string, password: string): Promise<string> {
    const account = await this.users.findByEmailWithHash(normalizeEmail(email));
    if (!account || !verifyPassword(password, account.passwordHash)) {
      throw new InvalidCredentials();
    }
    return this.signToken(account.user);
  }

  /**
   * Reads the profile from the database rather than from the token, so that
   * an initiation validated after the login shows at once.
   *
   * @throws UserNotFound when the account was deleted after the token was issued.
   */
  async me(userId: string): Promise<MeDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFound();

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      initiationValidated: user.initiationValidatedAt !== undefined,
    };
  }

  private signToken(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload);
  }
}
