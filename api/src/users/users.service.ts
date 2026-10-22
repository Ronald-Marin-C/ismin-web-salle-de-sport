import { Injectable } from '@nestjs/common';
import type { User as UserRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Role, User } from './user.js';

/**
 * Reads and writes the accounts.
 *
 * `toUser` is the boundary between the database and the domain: `role`
 * narrowed, `null` turned into `undefined`, and the password hash left out,
 * so that it cannot reach a response by accident.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role as Role,
      initiationValidatedAt: row.initiationValidatedAt ?? undefined,
      initiationValidatedBy: row.initiationValidatedBy ?? undefined,
    };
  }

  /** @returns The account, or `undefined` when no account has this id. */
  async findById(id: string): Promise<User | undefined> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toUser(row) : undefined;
  }

  /**
   * Looks up an account for the login: the only read that returns the password hash.
   *
   * @param email Lowercase, as stored.
   * @returns The account and its hash, or `undefined` when no account has this email.
   */
  async findByEmailWithHash(email: string): Promise<{ user: User; passwordHash: string } | undefined> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? { user: this.toUser(row), passwordHash: row.passwordHash } : undefined;
  }

  /**
   * Creates an account with the `student` role, the only one a registration can give.
   *
   * @param data `email` lowercase; `passwordHash` made by `hashPassword`.
   * @throws Prisma.PrismaClientKnownRequestError (code `P2002`) when the email is already used.
   */
  async createStudent(data: Pick<User, 'email' | 'firstName' | 'lastName'> & { passwordHash: string }): Promise<User> {
    const row = await this.prisma.user.create({ data: { ...data, role: 'student' } });
    return this.toUser(row);
  }
}
