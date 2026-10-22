/**
 * Populates the database with the test accounts of the README: the six
 * referents and two students. Running it twice changes nothing: an existing
 * account is left as it is, password hash included.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { hashPassword } from '../src/auth/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { Role } from '../src/users/user.js';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

/** Password of every seeded account. Development only, documented in the README. */
const DEV_PASSWORD = 'salle-de-sport';

interface SeedAccount {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  initiated: boolean;
  /** Email of the referent who validated the initiation; listed earlier in ACCOUNTS. */
  validatedBy?: string;
}

const ACCOUNTS: SeedAccount[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    email: `referent${n}@castelmont.fr`,
    firstName: 'Référent',
    lastName: String(n),
    role: 'referent' as const,
    initiated: true,
  })),
  {
    email: 'alice.martin@castelmont.fr',
    firstName: 'Alice',
    lastName: 'Martin',
    role: 'student',
    initiated: true,
    validatedBy: 'referent1@castelmont.fr',
  },
  { email: 'bob.durand@castelmont.fr', firstName: 'Bob', lastName: 'Durand', role: 'student', initiated: false },
];

async function main(): Promise<void> {
  for (const { initiated, validatedBy, ...account } of ACCOUNTS) {
    const validator = validatedBy
      ? await prisma.user.findUniqueOrThrow({ where: { email: validatedBy } })
      : undefined;

    await prisma.user.upsert({
      where: { email: account.email },
      create: {
        ...account,
        passwordHash: hashPassword(DEV_PASSWORD),
        initiationValidatedAt: initiated ? new Date() : null,
        initiationValidatedBy: validator?.id ?? null,
      },
      update: {},
    });
  }
  console.log(`✅ ${ACCOUNTS.length} users`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
