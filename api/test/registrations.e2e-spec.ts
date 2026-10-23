import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { Role } from '../src/users/user.js';
import { createUser, loginAs, resetDb } from './helpers.js';

const INITIATION_REQUIRED = "Votre initiation n'a pas encore été validée par un référent.";
const SLOT_NOT_BOOKABLE = "Ce créneau n'est plus disponible.";
const ALREADY_REGISTERED = 'Vous êtes déjà inscrit à ce créneau.';
const DAILY_LIMIT_REACHED = "Deux créneaux par jour maximum, liste d'attente comprise.";
const REGISTRATION_NOT_FOUND = 'Inscription introuvable.';
const NOT_YOUR_REGISTRATION = 'Cette inscription ne vous appartient pas.';
const CANCELLATION_TOO_LATE = "Désinscription possible jusqu'à une heure avant le créneau.";

type Slot = Record<string, unknown> & { date: string; hour: number };

/**
 * Booking and cancelling the slots, and the waiting list. The clock is fixed
 * on Wednesday 21 October 2026, 10:30, Paris time: the 10:00 slot has started.
 */
describe('Registrations API', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Same pipe as main.ts: `transform` turns the `hour` path parameter into a number.
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

  /** Creates an account, initiated unless told otherwise, and returns its id and access token. */
  async function connect(
    email: string,
    { role, initiated = true }: { role?: Role; initiated?: boolean } = {},
  ): Promise<{ id: string; token: string }> {
    const user = await createUser(prisma, { email, role, initiated });
    return { id: user.id, token: await loginAs(app, email) };
  }

  function book(token: string, date: string, hour: number | string) {
    return request(app.getHttpServer())
      .post(`/slots/${date}/${hour}/registrations`)
      .set('Authorization', `Bearer ${token}`);
  }

  /**
   * Registers new students in a slot straight in the database: `confirmed`
   * places taken, then `waiting` in line, all before the fixed clock.
   */
  async function fillSlot(date: string, hour: number, confirmed: number, waiting = 0): Promise<void> {
    for (let i = 0; i < confirmed + waiting; i++) {
      const user = await createUser(prisma, { email: `${date}.${hour}.${i}@castelmont.fr`, initiated: true });
      await prisma.registration.create({
        data: {
          userId: user.id,
          date,
          hour,
          status: i < confirmed ? 'confirmed' : 'waiting',
          createdAt: new Date(`2026-10-20T08:${String(i).padStart(2, '0')}:00`),
        },
      });
    }
  }

  function myRegistrations(token: string) {
    return request(app.getHttpServer()).get('/registrations/me').set('Authorization', `Bearer ${token}`);
  }

  /** Inserts a registration straight into the database; `createdAt` sets its place in the waiting list. */
  function addRegistration(
    userId: string,
    date: string,
    hour: number,
    status: 'confirmed' | 'waiting',
    createdAt: string,
  ) {
    return prisma.registration.create({ data: { userId, date, hour, status, createdAt: new Date(createdAt) } });
  }

  describe('POST /slots/:date/:hour/registrations', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).post('/slots/2026-10-22/18/registrations').expect(401);
    });

    it('refuses a student whose initiation has not been validated, and creates nothing', async () => {
      const bob = await connect('bob.durand@castelmont.fr', { initiated: false });

      const response = await book(bob.token, '2026-10-22', 18).expect(403);
      expect(response.body.message).toBe(INITIATION_REQUIRED);
      expect(await prisma.registration.count()).toBe(0);
    });

    it('confirms the place in a slot that has room', async () => {
      const me = await connect('chloe.petit@castelmont.fr');

      const response = await book(me.token, '2026-10-22', 18).expect(201);
      expect(response.body).toEqual({
        id: expect.any(String),
        date: '2026-10-22',
        hour: 18,
        status: 'confirmed',
        startsAt: '2026-10-22T16:00:00.000Z',
      });
      const row = await prisma.registration.findUniqueOrThrow({ where: { id: response.body.id } });
      expect(row).toMatchObject({ userId: me.id, date: '2026-10-22', hour: 18, status: 'confirmed' });
    });

    it('puts the 13th student first on the waiting list, and the 14th behind them', async () => {
      await fillSlot('2026-10-22', 18, 12);
      const thirteenth = await connect('thirteenth@castelmont.fr');
      const fourteenth = await connect('fourteenth@castelmont.fr');

      const first = await book(thirteenth.token, '2026-10-22', 18).expect(201);
      expect(first.body).toEqual({
        id: expect.any(String),
        date: '2026-10-22',
        hour: 18,
        status: 'waiting',
        position: 1,
        startsAt: '2026-10-22T16:00:00.000Z',
      });

      vi.setSystemTime(new Date('2026-10-21T10:31:00'));
      const second = await book(fourteenth.token, '2026-10-22', 18).expect(201);
      expect(second.body).toMatchObject({ status: 'waiting', position: 2 });
    });

    it('counts the places and the waiting list of the booked slot only', async () => {
      // Full slots on the same day and at the same hour, some with people waiting.
      await fillSlot('2026-10-22', 18, 12, 1);
      await fillSlot('2026-10-22', 19, 12);
      await fillSlot('2026-10-23', 19, 12, 1);
      const me = await connect('chloe.petit@castelmont.fr');

      const waiting = await book(me.token, '2026-10-22', 19).expect(201);
      expect(waiting.body).toMatchObject({ status: 'waiting', position: 1 });
      const sameDay = await book(me.token, '2026-10-22', 20).expect(201);
      expect(sameDay.body.status).toBe('confirmed');
      const sameHour = await book(me.token, '2026-10-24', 18).expect(201);
      expect(sameHour.body.status).toBe('confirmed');
    });

    it('refuses the same slot twice', async () => {
      const me = await connect('chloe.petit@castelmont.fr');
      await book(me.token, '2026-10-22', 18).expect(201);

      const response = await book(me.token, '2026-10-22', 18).expect(409);
      expect(response.body.message).toBe(ALREADY_REGISTERED);
      expect(await prisma.registration.count()).toBe(1);
    });

    it('answers 409 rather than 422 when the slot booked again is on a day already full', async () => {
      const me = await connect('chloe.petit@castelmont.fr');
      await book(me.token, '2026-10-22', 18).expect(201);
      await book(me.token, '2026-10-22', 19).expect(201);

      const response = await book(me.token, '2026-10-22', 18).expect(409);
      expect(response.body.message).toBe(ALREADY_REGISTERED);
    });

    it('allows two slots a day, the waiting list included, refuses a third, and accepts the next day', async () => {
      await fillSlot('2026-10-22', 19, 12);
      const me = await connect('chloe.petit@castelmont.fr');
      await book(me.token, '2026-10-22', 18).expect(201);
      const waiting = await book(me.token, '2026-10-22', 19).expect(201);
      expect(waiting.body.status).toBe('waiting');

      const third = await book(me.token, '2026-10-22', 20).expect(422);
      expect(third.body.message).toBe(DAILY_LIMIT_REACHED);
      await book(me.token, '2026-10-23', 18).expect(201);
    });

    it('refuses the slot that has started, and accepts the next one', async () => {
      const me = await connect('chloe.petit@castelmont.fr');

      const response = await book(me.token, '2026-10-21', 10).expect(422);
      expect(response.body.message).toBe(SLOT_NOT_BOOKABLE);
      await book(me.token, '2026-10-21', 11).expect(201);
    });

    it.each([
      ['a day after the seventh', '2026-10-28', 18],
      ['yesterday', '2026-10-20', 18],
      ['the closing hour', '2026-10-22', 22],
      ['an hour before the opening', '2026-10-22', 6],
    ])('refuses %s', async (_case, date, hour) => {
      const me = await connect('chloe.petit@castelmont.fr');

      const response = await book(me.token, date, hour).expect(422);
      expect(response.body.message).toBe(SLOT_NOT_BOOKABLE);
      expect(await prisma.registration.count()).toBe(0);
    });

    it.each(['22-10-2026', '2026-10-2', 'tomorrow'])('answers 400 for the malformed date %s', async (date) => {
      const me = await connect('chloe.petit@castelmont.fr');

      await book(me.token, date, 18).expect(400);
    });

    it.each(['abc', '18.5'])('answers 400 for the hour %s, which is not an integer', async (hour) => {
      const me = await connect('chloe.petit@castelmont.fr');

      await book(me.token, '2026-10-22', hour).expect(400);
    });

    it('lets a referent book like everyone, taking one of the 12 places', async () => {
      await fillSlot('2026-10-22', 18, 11);
      const referent = await connect('referent1@castelmont.fr', { role: 'referent' });
      const student = await connect('chloe.petit@castelmont.fr');

      const own = await book(referent.token, '2026-10-22', 18).expect(201);
      expect(own.body.status).toBe('confirmed');
      const next = await book(student.token, '2026-10-22', 18).expect(201);
      expect(next.body).toMatchObject({ status: 'waiting', position: 1 });
    });

    it('keeps one registration when the same request arrives twice at once', async () => {
      const me = await connect('chloe.petit@castelmont.fr');

      const responses = await Promise.all([book(me.token, '2026-10-22', 18), book(me.token, '2026-10-22', 18)]);
      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      expect(await prisma.registration.count()).toBe(1);
    });

    it('never confirms a 13th place when two students take the last one at once', async () => {
      await fillSlot('2026-10-22', 18, 11);
      const first = await connect('first@castelmont.fr');
      const second = await connect('second@castelmont.fr');

      const responses = await Promise.all([book(first.token, '2026-10-22', 18), book(second.token, '2026-10-22', 18)]);
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(responses.map((response) => response.body.status).sort()).toEqual(['confirmed', 'waiting']);
      expect(await prisma.registration.count({ where: { date: '2026-10-22', hour: 18, status: 'confirmed' } })).toBe(12);
    });
  });

  describe('GET /registrations/me', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/registrations/me').expect(401);
    });

    it("lists the user's own registrations by date and hour, with their place in the waiting list", async () => {
      const me = await connect('chloe.petit@castelmont.fr');
      const other = await createUser(prisma, { email: 'bob.durand@castelmont.fr', initiated: true });
      // A full slot: one person waits since 08:12, before me; another since 08:40, inserted first.
      await fillSlot('2026-10-22', 19, 12, 1);
      await addRegistration(other.id, '2026-10-22', 19, 'waiting', '2026-10-20T08:40:00');
      // Inserted out of order: the list follows the date, then the hour.
      const later = await addRegistration(me.id, '2026-10-23', 18, 'confirmed', '2026-10-20T08:20:00');
      const waiting = await addRegistration(me.id, '2026-10-22', 19, 'waiting', '2026-10-20T08:30:00');
      const morning = await addRegistration(me.id, '2026-10-22', 7, 'confirmed', '2026-10-20T08:50:00');
      await addRegistration(other.id, '2026-10-24', 18, 'confirmed', '2026-10-20T08:00:00');

      const response = await myRegistrations(me.token).expect(200);
      expect(response.body).toEqual([
        { id: morning.id, date: '2026-10-22', hour: 7, status: 'confirmed', startsAt: '2026-10-22T05:00:00.000Z' },
        {
          id: waiting.id,
          date: '2026-10-22',
          hour: 19,
          status: 'waiting',
          position: 2,
          startsAt: '2026-10-22T17:00:00.000Z',
        },
        { id: later.id, date: '2026-10-23', hour: 18, status: 'confirmed', startsAt: '2026-10-23T16:00:00.000Z' },
      ]);
    });

    it('leaves out the slots that are over, and keeps the one in progress', async () => {
      const me = await connect('chloe.petit@castelmont.fr');
      await addRegistration(me.id, '2026-10-20', 18, 'confirmed', '2026-10-19T08:00:00');
      await addRegistration(me.id, '2026-10-21', 9, 'confirmed', '2026-10-20T08:00:00');
      const current = await addRegistration(me.id, '2026-10-21', 10, 'confirmed', '2026-10-20T08:01:00');

      const response = await myRegistrations(me.token).expect(200);
      expect(response.body).toEqual([
        { id: current.id, date: '2026-10-21', hour: 10, status: 'confirmed', startsAt: '2026-10-21T08:00:00.000Z' },
      ]);
    });
  });

  describe('DELETE /registrations/:id', () => {
    function cancel(token: string, id: string) {
      return request(app.getHttpServer()).delete(`/registrations/${id}`).set('Authorization', `Bearer ${token}`);
    }

    /** A slot as `GET /slots` shows it to the user. */
    async function slotOf(token: string, date: string, hour: number): Promise<Slot | undefined> {
      const response = await request(app.getHttpServer())
        .get('/slots')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return (response.body as Slot[]).find((slot) => slot.date === date && slot.hour === hour);
    }

    function findRegistration(id: string) {
      return prisma.registration.findUnique({ where: { id } });
    }

    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).delete('/registrations/any-id').expect(401);
    });

    it('gives the place of a confirmed student to the first in the waiting list', async () => {
      const me = await connect('chloe.petit@castelmont.fr');
      const first = await connect('first@castelmont.fr');
      const second = await connect('second@castelmont.fr');
      await fillSlot('2026-10-22', 18, 11);
      const mine = await addRegistration(me.id, '2026-10-22', 18, 'confirmed', '2026-10-20T09:00:00');
      // Inserted out of order: the waiting list follows the time of registration.
      await addRegistration(second.id, '2026-10-22', 18, 'waiting', '2026-10-20T09:20:00');
      const firstInLine = await addRegistration(first.id, '2026-10-22', 18, 'waiting', '2026-10-20T09:10:00');

      await cancel(me.token, mine.id).expect(204);
      expect(await findRegistration(mine.id)).toBeNull();
      expect(await findRegistration(firstInLine.id)).toMatchObject({ status: 'confirmed' });
      expect(await slotOf(second.token, '2026-10-22', 18)).toMatchObject({
        remaining: 0,
        waitingCount: 1,
        myStatus: 'waiting',
        myPosition: 1,
      });
    });

    it('promotes someone waiting for the cancelled slot only', async () => {
      // Waiting since before anyone in the cancelled slot: the same day at another hour, the same hour another day.
      await fillSlot('2026-10-22', 19, 12, 1);
      await fillSlot('2026-10-23', 18, 12, 1);
      const me = await connect('chloe.petit@castelmont.fr');
      const next = await connect('next@castelmont.fr');
      await fillSlot('2026-10-22', 18, 11);
      const mine = await addRegistration(me.id, '2026-10-22', 18, 'confirmed', '2026-10-20T09:00:00');
      const waiting = await addRegistration(next.id, '2026-10-22', 18, 'waiting', '2026-10-20T09:10:00');

      await cancel(me.token, mine.id).expect(204);
      expect(await findRegistration(waiting.id)).toMatchObject({ status: 'confirmed' });
      expect(await prisma.registration.count({ where: { status: 'waiting' } })).toBe(2);
    });

    it('promotes nobody when a student leaves the waiting list, and moves up those behind', async () => {
      await fillSlot('2026-10-22', 18, 12);
      const me = await connect('chloe.petit@castelmont.fr');
      const behind = await connect('behind@castelmont.fr');
      const mine = await addRegistration(me.id, '2026-10-22', 18, 'waiting', '2026-10-20T09:00:00');
      await addRegistration(behind.id, '2026-10-22', 18, 'waiting', '2026-10-20T09:10:00');

      await cancel(me.token, mine.id).expect(204);
      expect(await findRegistration(mine.id)).toBeNull();
      expect(await slotOf(behind.token, '2026-10-22', 18)).toMatchObject({
        remaining: 0,
        waitingCount: 1,
        myStatus: 'waiting',
        myPosition: 1,
      });
    });

    it('frees the place when nobody is waiting', async () => {
      const me = await connect('chloe.petit@castelmont.fr');
      const booked = await book(me.token, '2026-10-22', 18).expect(201);

      await cancel(me.token, booked.body.id).expect(204);
      const slot = await slotOf(me.token, '2026-10-22', 18);
      expect(slot).toMatchObject({ remaining: 12, waitingCount: 0 });
      expect(slot).not.toHaveProperty('myStatus');
    });

    it('shows the promoted student their confirmed place in GET /registrations/me', async () => {
      await fillSlot('2026-10-22', 18, 11);
      const me = await connect('chloe.petit@castelmont.fr');
      const next = await connect('next@castelmont.fr');
      const mine = await addRegistration(me.id, '2026-10-22', 18, 'confirmed', '2026-10-20T09:00:00');
      const waiting = await addRegistration(next.id, '2026-10-22', 18, 'waiting', '2026-10-20T09:10:00');

      await cancel(me.token, mine.id).expect(204);
      const response = await myRegistrations(next.token).expect(200);
      expect(response.body).toEqual([
        { id: waiting.id, date: '2026-10-22', hour: 18, status: 'confirmed', startsAt: '2026-10-22T16:00:00.000Z' },
      ]);
    });

    it('allows cancelling until one hour before the slot, to the second', async () => {
      // Connected at 12:30: a token signed at 10:30 would have expired by 13:00.
      vi.setSystemTime(new Date('2026-10-21T12:30:00'));
      const me = await connect('chloe.petit@castelmont.fr');
      const booked = await book(me.token, '2026-10-21', 14).expect(201);

      vi.setSystemTime(new Date('2026-10-21T13:00:00'));
      await cancel(me.token, booked.body.id).expect(204);
    });

    it.each(['confirmed', 'waiting'] as const)(
      'refuses to cancel a %s registration less than one hour before the slot, and keeps it',
      async (status) => {
        // Connected at 12:30: a token signed at 10:30 would have expired by 13:00.
        vi.setSystemTime(new Date('2026-10-21T12:30:00'));
        const me = await connect('chloe.petit@castelmont.fr');
        const mine = await addRegistration(me.id, '2026-10-21', 14, status, '2026-10-20T09:00:00');

        vi.setSystemTime(new Date('2026-10-21T13:00:01'));
        const response = await cancel(me.token, mine.id).expect(422);
        expect(response.body.message).toBe(CANCELLATION_TOO_LATE);
        expect(await findRegistration(mine.id)).not.toBeNull();
      },
    );

    it("refuses to cancel someone else's registration, and keeps it", async () => {
      const owner = await connect('bob.durand@castelmont.fr');
      const me = await connect('chloe.petit@castelmont.fr');
      const theirs = await book(owner.token, '2026-10-22', 18).expect(201);

      const response = await cancel(me.token, theirs.body.id).expect(403);
      expect(response.body.message).toBe(NOT_YOUR_REGISTRATION);
      expect(await findRegistration(theirs.body.id)).not.toBeNull();
    });

    it("answers 403 rather than 422 for someone else's registration too late to cancel", async () => {
      const owner = await connect('bob.durand@castelmont.fr');
      const me = await connect('chloe.petit@castelmont.fr');
      const theirs = await book(owner.token, '2026-10-21', 11).expect(201);

      const response = await cancel(me.token, theirs.body.id).expect(403);
      expect(response.body.message).toBe(NOT_YOUR_REGISTRATION);
    });

    it('answers 404 for a registration already cancelled', async () => {
      const me = await connect('chloe.petit@castelmont.fr');
      const booked = await book(me.token, '2026-10-22', 18).expect(201);
      await cancel(me.token, booked.body.id).expect(204);

      const response = await cancel(me.token, booked.body.id).expect(404);
      expect(response.body.message).toBe(REGISTRATION_NOT_FOUND);
    });

    it('lets the student book the slot again, which counts towards the daily limit again', async () => {
      const me = await connect('chloe.petit@castelmont.fr');
      const booked = await book(me.token, '2026-10-22', 18).expect(201);
      await book(me.token, '2026-10-22', 19).expect(201);

      await cancel(me.token, booked.body.id).expect(204);
      await book(me.token, '2026-10-22', 18).expect(201);
      const third = await book(me.token, '2026-10-22', 20).expect(422);
      expect(third.body.message).toBe(DAILY_LIMIT_REACHED);
    });
  });
});
