import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { Role } from '../src/users/user.js';
import { createUser, loginAs, resetDb } from './helpers.js';

const ACCOUNT_NOT_FOUND = 'Compte introuvable.';
const INITIATION_REQUIRED = "Votre initiation n'a pas encore été validée par un référent.";

/** The fixed clock, 10:30 in Paris, as the API serialises it. */
const NOW_ISO = '2026-10-21T08:30:00.000Z';

/**
 * The referents' routes: searching the students, validating their initiation
 * and seeing who registered to a slot. The clock is fixed on Wednesday
 * 21 October 2026, 10:30, Paris time.
 */
describe('Referent API', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Same pipe as main.ts: `transform` turns the query and path parameters into their DTOs.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T10:30:00'));
    await resetDb(prisma);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Creates an account, a student unless told otherwise, and returns its id and access token. */
  async function connect(
    email: string,
    options: { role?: Role; initiated?: boolean; firstName?: string; lastName?: string } = {},
  ): Promise<{ id: string; token: string }> {
    const user = await createUser(prisma, { email, ...options });
    return { id: user.id, token: await loginAs(app, email) };
  }

  function connectReferent(email = 'referent1@castelmont.fr') {
    return connect(email, { role: 'referent', initiated: true });
  }

  function searchUsers(token: string) {
    return request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${token}`);
  }

  function validate(token: string, userId: string) {
    return request(app.getHttpServer()).patch(`/users/${userId}/initiation`).set('Authorization', `Bearer ${token}`);
  }

  function slotRegistrations(token: string, date: string, hour: number | string) {
    return request(app.getHttpServer())
      .get(`/slots/${date}/${hour}/registrations`)
      .set('Authorization', `Bearer ${token}`);
  }

  /** Registers a new student in a slot straight in the database; `createdAt` sets the order of arrival. */
  async function addRegistration(
    firstName: string,
    lastName: string,
    slot: { date: string; hour: number },
    status: 'confirmed' | 'waiting',
    createdAt: string,
  ): Promise<void> {
    const email = `${firstName}.${lastName}@castelmont.fr`.toLowerCase();
    const user = await createUser(prisma, { email, firstName, lastName, initiated: true });
    await prisma.registration.create({
      data: { userId: user.id, date: slot.date, hour: slot.hour, status, createdAt: new Date(createdAt) },
    });
  }

  describe('GET /users', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('answers 403 to a student', async () => {
      const student = await connect('chloe.petit@castelmont.fr', { initiated: true });

      await searchUsers(student.token).expect(403);
    });

    it('finds the students whose last name, first name or email contains the search, whatever the case', async () => {
      const referent = await connectReferent();
      // Each one matches through a single field.
      await createUser(prisma, { email: 'alice.m@castelmont.fr', firstName: 'Alice', lastName: 'Martin' });
      await createUser(prisma, { email: 'm.roux@castelmont.fr', firstName: 'Martine', lastName: 'Roux' });
      await createUser(prisma, { email: 'hugo.martel@castelmont.fr', firstName: 'Hugo', lastName: 'Bernard' });
      await createUser(prisma, { email: 'bob.durand@castelmont.fr', firstName: 'Bob', lastName: 'Durand' });
      // A referent whose name matches, left out because of the role.
      await createUser(prisma, {
        email: 'referent2@castelmont.fr',
        role: 'referent',
        initiated: true,
        firstName: 'Paul',
        lastName: 'Martinez',
      });

      const response = await searchUsers(referent.token).query({ search: 'mart' }).expect(200);
      expect(response.body.map((student: { email: string }) => student.email)).toEqual([
        'hugo.martel@castelmont.fr',
        'alice.m@castelmont.fr',
        'm.roux@castelmont.fr',
      ]);
    });

    it('lists every student without a search, by last name then first name, with their initiation', async () => {
      const referent = await connectReferent();
      const lucas = await createUser(prisma, {
        email: 'lucas.martin@castelmont.fr',
        firstName: 'Lucas',
        lastName: 'Martin',
        initiated: true,
      });
      const bob = await createUser(prisma, { email: 'bob.durand@castelmont.fr', firstName: 'Bob', lastName: 'Durand' });
      const alice = await createUser(prisma, {
        email: 'alice.martin@castelmont.fr',
        firstName: 'Alice',
        lastName: 'Martin',
      });

      const response = await searchUsers(referent.token).expect(200);
      expect(response.body).toEqual([
        {
          id: bob.id,
          firstName: 'Bob',
          lastName: 'Durand',
          email: 'bob.durand@castelmont.fr',
          initiationValidated: false,
        },
        {
          id: alice.id,
          firstName: 'Alice',
          lastName: 'Martin',
          email: 'alice.martin@castelmont.fr',
          initiationValidated: false,
        },
        {
          id: lucas.id,
          firstName: 'Lucas',
          lastName: 'Martin',
          email: 'lucas.martin@castelmont.fr',
          initiationValidated: true,
          initiationValidatedAt: NOW_ISO,
        },
      ]);
    });

    it('returns 50 students at most', async () => {
      const referent = await connectReferent();
      await prisma.user.createMany({
        data: Array.from({ length: 51 }, (_, i) => ({
          email: `student${i}@castelmont.fr`,
          passwordHash: 'not-used',
          firstName: 'Test',
          lastName: `Student ${String(i).padStart(2, '0')}`,
        })),
      });

      const response = await searchUsers(referent.token).expect(200);
      expect(response.body).toHaveLength(50);
      expect(response.body.at(-1).lastName).toBe('Student 49');
    });

    it('accepts a search of 100 characters and refuses one of 101', async () => {
      const referent = await connectReferent();

      await searchUsers(referent.token).query({ search: 'a'.repeat(100) }).expect(200);
      await searchUsers(referent.token).query({ search: 'a'.repeat(101) }).expect(400);
    });

    it('refuses a repeated search parameter', async () => {
      const referent = await connectReferent();

      await searchUsers(referent.token).query('search=mart&search=dur').expect(400);
    });
  });

  describe('PATCH /users/:id/initiation', () => {
    it('answers 401 without a token', async () => {
      const bob = await createUser(prisma, { email: 'bob.durand@castelmont.fr' });

      await request(app.getHttpServer()).patch(`/users/${bob.id}/initiation`).expect(401);
    });

    it('answers 403 to a student validating their own initiation, and validates nothing', async () => {
      const bob = await connect('bob.durand@castelmont.fr');

      await validate(bob.token, bob.id).expect(403);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: bob.id } });
      expect(row.initiationValidatedAt).toBeNull();
    });

    it('validates the initiation, stamped with the time and the referent', async () => {
      const referent = await connectReferent();
      const bob = await createUser(prisma, { email: 'bob.durand@castelmont.fr', firstName: 'Bob', lastName: 'Durand' });

      const response = await validate(referent.token, bob.id).expect(200);
      expect(response.body).toEqual({
        id: bob.id,
        firstName: 'Bob',
        lastName: 'Durand',
        email: 'bob.durand@castelmont.fr',
        initiationValidated: true,
        initiationValidatedAt: NOW_ISO,
      });
      const row = await prisma.user.findUniqueOrThrow({ where: { id: bob.id } });
      expect(row.initiationValidatedAt).toEqual(new Date(NOW_ISO));
      expect(row.initiationValidatedBy).toBe(referent.id);
    });

    it('keeps the first validation when another referent validates again later', async () => {
      const first = await connectReferent('referent1@castelmont.fr');
      const second = await connectReferent('referent2@castelmont.fr');
      const bob = await createUser(prisma, { email: 'bob.durand@castelmont.fr' });
      await validate(first.token, bob.id).expect(200);

      vi.setSystemTime(new Date('2026-10-21T10:40:00'));
      const response = await validate(second.token, bob.id).expect(200);
      expect(response.body).toMatchObject({ initiationValidated: true, initiationValidatedAt: NOW_ISO });
      const row = await prisma.user.findUniqueOrThrow({ where: { id: bob.id } });
      expect(row.initiationValidatedAt).toEqual(new Date(NOW_ISO));
      expect(row.initiationValidatedBy).toBe(first.id);
    });

    it('answers 404 for an unknown account', async () => {
      const referent = await connectReferent();

      const response = await validate(referent.token, '00000000-0000-0000-0000-000000000000').expect(404);
      expect(response.body.message).toBe(ACCOUNT_NOT_FOUND);
    });

    it('lets a student book, with the token they already had, once a referent has validated their initiation', async () => {
      const bob = await connect('bob.durand@castelmont.fr');
      const referent = await connectReferent();
      const book = () =>
        request(app.getHttpServer())
          .post('/slots/2026-10-22/18/registrations')
          .set('Authorization', `Bearer ${bob.token}`);

      const refused = await book().expect(403);
      expect(refused.body.message).toBe(INITIATION_REQUIRED);

      await validate(referent.token, bob.id).expect(200);
      const booked = await book().expect(201);
      expect(booked.body.status).toBe('confirmed');
    });
  });

  describe('GET /slots/:date/:hour/registrations', () => {
    const slot = { date: '2026-10-22', hour: 18 };

    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/slots/2026-10-22/18/registrations').expect(401);
    });

    it('answers 403 to a student', async () => {
      const student = await connect('chloe.petit@castelmont.fr', { initiated: true });

      await slotRegistrations(student.token, '2026-10-22', 18).expect(403);
    });

    it('lists the confirmed students, then the waiting list with the positions, both in order of arrival', async () => {
      const referent = await connectReferent();
      await addRegistration('Alice', 'Martin', slot, 'confirmed', '2026-10-20T08:02:00');
      await addRegistration('Chloe', 'Petit', slot, 'waiting', '2026-10-20T08:05:00');
      await addRegistration('Bob', 'Durand', slot, 'confirmed', '2026-10-20T08:00:00');
      await addRegistration('David', 'Roux', slot, 'waiting', '2026-10-20T08:03:00');

      const response = await slotRegistrations(referent.token, '2026-10-22', 18).expect(200);
      expect(response.body).toEqual({
        confirmed: [
          { firstName: 'Bob', lastName: 'Durand', email: 'bob.durand@castelmont.fr' },
          { firstName: 'Alice', lastName: 'Martin', email: 'alice.martin@castelmont.fr' },
        ],
        waiting: [
          { firstName: 'David', lastName: 'Roux', email: 'david.roux@castelmont.fr', position: 1 },
          { firstName: 'Chloe', lastName: 'Petit', email: 'chloe.petit@castelmont.fr', position: 2 },
        ],
      });
    });

    it('lists the registrations of this slot only', async () => {
      const referent = await connectReferent();
      await addRegistration('Bob', 'Durand', slot, 'confirmed', '2026-10-20T08:00:00');
      // The same day at another hour, and another day at the same hour, registered earlier.
      await addRegistration('Emma', 'Blanc', { date: '2026-10-22', hour: 19 }, 'confirmed', '2026-10-19T08:00:00');
      await addRegistration('Felix', 'Noir', { date: '2026-10-22', hour: 19 }, 'waiting', '2026-10-19T08:01:00');
      await addRegistration('Gael', 'Morel', { date: '2026-10-23', hour: 18 }, 'confirmed', '2026-10-19T08:02:00');
      await addRegistration('Hugo', 'Leroy', { date: '2026-10-23', hour: 18 }, 'waiting', '2026-10-19T08:03:00');

      const response = await slotRegistrations(referent.token, '2026-10-22', 18).expect(200);
      expect(response.body).toEqual({
        confirmed: [{ firstName: 'Bob', lastName: 'Durand', email: 'bob.durand@castelmont.fr' }],
        waiting: [],
      });
    });

    it('answers 400 for a malformed date or hour', async () => {
      const referent = await connectReferent();

      await slotRegistrations(referent.token, '22-10-2026', 18).expect(400);
      await slotRegistrations(referent.token, '2026-10-22', 'abc').expect(400);
    });
  });
});
