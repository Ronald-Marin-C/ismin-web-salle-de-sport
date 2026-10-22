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
}
