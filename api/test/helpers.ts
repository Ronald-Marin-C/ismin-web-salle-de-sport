import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashPassword } from '../src/auth/password.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { Role } from '../src/users/user.js';

/** Password of every account created by {@link createUser}. */
export const TEST_PASSWORD = 'password123';

/**
 * Inserts an account straight into the database, bypassing registration:
 * the only way to create a referent, as registration only creates students.
 *
 * @param prisma The application's Prisma client.
 * @param options `role` defaults to `student`; `initiated` (default `false`)
 * marks the initiation as validated.
 * @returns The created row.
 */
export function createUser(
  prisma: PrismaService,
  { email, role = 'student', initiated = false }: { email: string; role?: Role; initiated?: boolean },
) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(TEST_PASSWORD),
      firstName: 'Test',
      lastName: 'User',
      role,
      initiationValidatedAt: initiated ? new Date() : null,
    },
  });
}

/**
 * Logs in an account created by {@link createUser}.
 *
 * @returns The access token.
 */
export async function loginAs(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  return response.body.access_token as string;
}

/** Empties the tables, so that every test starts from a blank database. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.registration.deleteMany();
  await prisma.user.deleteMany();
}
