import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createUser, loginAs, resetDb } from './helpers.js';

type Status = 'confirmed' | 'waiting';
type Slot = Record<string, unknown> & { date: string; hour: number };

const DATES = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];

/**
 * The planning of the next seven days, computed from the registrations.
 * The clock is fixed on Wednesday 21 October 2026, 10:30, Paris time.
 */
describe('GET /slots', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
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

  /** Creates a student and returns their id and access token. */
  async function connect(email: string): Promise<{ id: string; token: string }> {
    const user = await createUser(prisma, { email });
    return { id: user.id, token: await loginAs(app, email) };
  }

  /**
   * Inserts a registration straight into the database. With the clock frozen,
   * every default `createdAt` would be equal: `minute` sets the order of the
   * waiting list explicitly.
   */
  function addRegistration(userId: string, date: string, hour: number, status: Status, minute: number) {
    const createdAt = new Date(`2026-10-20T08:${String(minute).padStart(2, '0')}:00`);
    return prisma.registration.create({ data: { userId, date, hour, status, createdAt } });
  }

  /** Registers new students in a slot: `confirmed` places taken, then `waiting` in line. */
  async function fillSlot(date: string, hour: number, confirmed: number, waiting: number): Promise<void> {
    for (let i = 0; i < confirmed + waiting; i++) {
      const user = await createUser(prisma, { email: `${date}.${hour}.${i}@castelmont.fr` });
      await addRegistration(user.id, date, hour, i < confirmed ? 'confirmed' : 'waiting', i);
    }
  }

  async function getSlots(token: string): Promise<Slot[]> {
    const response = await request(app.getHttpServer())
      .get('/slots')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toHaveLength(105);
    return response.body as Slot[];
  }

  function findSlot(slots: Slot[], date: string, hour: number): Slot | undefined {
    return slots.find((slot) => slot.date === date && slot.hour === hour);
  }

  it('answers 401 without a token', async () => {
    await request(app.getHttpServer()).get('/slots').expect(401);
  });

  it('lists the 15 slots of each of the seven days, from 7:00 today to 21:00 on the seventh day', async () => {
    const { token } = await connect('chloe.petit@castelmont.fr');
    const slots = await getSlots(token);

    const expected = DATES.flatMap((date) => Array.from({ length: 15 }, (_, i) => ({ date, hour: 7 + i })));
    expect(slots.map(({ date, hour }) => ({ date, hour }))).toEqual(expected);
    expect(slots[0].startsAt).toBe('2026-10-21T05:00:00.000Z');
    expect(slots[104].startsAt).toBe('2026-10-27T20:00:00.000Z');
  });

  it('shows 12 places and an empty waiting list everywhere when nobody registered', async () => {
    const { token } = await connect('chloe.petit@castelmont.fr');
    const slots = await getSlots(token);

    for (const slot of slots) {
      expect(slot).toMatchObject({ remaining: 12, waitingCount: 0 });
    }
  });

  it('counts the confirmed places and the waiting list of each slot', async () => {
    await fillSlot('2026-10-22', 18, 12, 2);
    await fillSlot('2026-10-23', 18, 3, 1);
    const { token } = await connect('chloe.petit@castelmont.fr');
    const slots = await getSlots(token);

    expect(findSlot(slots, '2026-10-22', 18)).toMatchObject({ remaining: 0, waitingCount: 2 });
    expect(findSlot(slots, '2026-10-23', 18)).toMatchObject({ remaining: 9, waitingCount: 1 });
    expect(findSlot(slots, '2026-10-22', 17)).toMatchObject({ remaining: 12, waitingCount: 0 });
  });

  it('marks as past the slots that have started, the current one included', async () => {
    const { token } = await connect('chloe.petit@castelmont.fr');
    const slots = await getSlots(token);

    const past = slots.filter((slot) => slot.isPast).map(({ date, hour }) => ({ date, hour }));
    expect(past).toEqual([7, 8, 9, 10].map((hour) => ({ date: '2026-10-21', hour })));
    expect(findSlot(slots, '2026-10-21', 11)).toMatchObject({ isPast: false });
  });

  it("gives the connected user their status, their place in the waiting list and their registration's id", async () => {
    const me = await connect('chloe.petit@castelmont.fr');
    const confirmed = await addRegistration(me.id, '2026-10-22', 18, 'confirmed', 0);

    // Inserted out of order: the place follows createdAt, not the insertion.
    await fillSlot('2026-10-23', 18, 12, 0);
    const first = await createUser(prisma, { email: 'first@castelmont.fr' });
    const last = await createUser(prisma, { email: 'last@castelmont.fr' });
    const waiting = await addRegistration(me.id, '2026-10-23', 18, 'waiting', 30);
    await addRegistration(last.id, '2026-10-23', 18, 'waiting', 40);
    await addRegistration(first.id, '2026-10-23', 18, 'waiting', 20);

    const mine = await getSlots(me.token);
    const confirmedSlot = findSlot(mine, '2026-10-22', 18);
    expect(confirmedSlot).toMatchObject({ myStatus: 'confirmed', myRegistrationId: confirmed.id });
    expect(confirmedSlot).not.toHaveProperty('myPosition');
    expect(findSlot(mine, '2026-10-23', 18)).toMatchObject({
      myStatus: 'waiting',
      myPosition: 2,
      myRegistrationId: waiting.id,
    });
    expect(findSlot(mine, '2026-10-24', 18)).not.toHaveProperty('myStatus');

    const other = await connect('bob.durand@castelmont.fr');
    const theirs = await getSlots(other.token);
    for (const slot of [findSlot(theirs, '2026-10-22', 18), findSlot(theirs, '2026-10-23', 18)]) {
      expect(slot).not.toHaveProperty('myStatus');
      expect(slot).not.toHaveProperty('myPosition');
      expect(slot).not.toHaveProperty('myRegistrationId');
    }
  });

  it('shows a student the numbers only, never who registered', async () => {
    await fillSlot('2026-10-22', 18, 12, 2);
    const { token } = await connect('chloe.petit@castelmont.fr');
    const slots = await getSlots(token);

    for (const slot of slots) {
      expect(slot).not.toHaveProperty('userId');
      expect(slot).not.toHaveProperty('email');
      expect(slot).not.toHaveProperty('firstName');
      expect(slot).not.toHaveProperty('lastName');
    }
    expect(JSON.stringify(slots)).not.toContain('@castelmont.fr');
  });
});
