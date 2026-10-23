import { Injectable } from '@nestjs/common';
import type { User as UserRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserNotFound, type Role, type Student, type User } from './user.js';

/** Most students a search returns. */
const MAX_SEARCH_RESULTS = 50;

/**
 * Reads and writes the accounts.
 *
 * `toUser` and `toStudent` are the boundary between the database and the
 * domain: `role` narrowed, `null` turned into `undefined`, and the password
 * hash left out, so that it cannot reach a response by accident.
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

  private toStudent(row: UserRow): Student {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      initiationValidated: row.initiationValidatedAt !== null,
      initiationValidatedAt: row.initiationValidatedAt ?? undefined,
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

  /**
   * Searches the students, referents left out.
   *
   * @param search Part of the first name, the last name or the email; every student when absent.
   * @returns At most 50 students, by last name then first name.
   */
  async searchStudents(search?: string): Promise<Student[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        role: 'student',
        // On SQLite, `contains` ignores the case of unaccented letters only:
        // `mode: 'insensitive'` is not supported there.
        ...(search && {
          OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { email: { contains: search } }],
        }),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: MAX_SEARCH_RESULTS,
    });
    return rows.map((row) => this.toStudent(row));
  }

  /**
   * Validates the initiation of an account, which allows it to book. Validating it again
   * changes nothing: the first date and the first referent are kept.
   *
   * @param referentId The referent who validates it.
   * @param now The date of the validation.
   * @throws UserNotFound when no account has this id.
   */
  async validateInitiation(userId: string, referentId: string, now: Date): Promise<Student> {
    // The condition keeps the first validation, even when two referents validate at the same instant.
    await this.prisma.user.updateMany({
      where: { id: userId, initiationValidatedAt: null },
      data: { initiationValidatedAt: now, initiationValidatedBy: referentId },
    });
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!row) throw new UserNotFound();
    return this.toStudent(row);
  }
}
