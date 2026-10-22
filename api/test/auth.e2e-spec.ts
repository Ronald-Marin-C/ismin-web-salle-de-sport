import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createUser, loginAs, resetDb, TEST_PASSWORD } from './helpers.js';

const chloe = {
  firstName: 'Chloé',
  lastName: 'Petit',
  email: 'chloe.petit@castelmont.fr',
  password: 'correct-horse',
};

/** The payload of a JWT, read without verifying it. */
function decodeToken(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

/** Registration of students, login with the school email, and the profile route. */
describe('/auth API', () => {
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
    await resetDb(prisma);
  });

  function register(body: object) {
    return request(app.getHttpServer()).post('/auth/register').send(body);
  }

  function me(token: string) {
    return request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`);
  }

  describe('POST /auth/register', () => {
    it('creates a student and returns a token carrying their id, email and role', async () => {
      const response = await register(chloe).expect(201);
      expect(response.body).toEqual({ access_token: expect.any(String) });
      const token: string = response.body.access_token;
      expect(token.split('.')).toHaveLength(3);

      const profile = await me(token).expect(200);
      expect(profile.body).toEqual({
        id: expect.any(String),
        email: 'chloe.petit@castelmont.fr',
        firstName: 'Chloé',
        lastName: 'Petit',
        role: 'student',
        initiationValidated: false,
      });
      expect(decodeToken(token)).toMatchObject({
        sub: profile.body.id,
        email: 'chloe.petit@castelmont.fr',
        role: 'student',
      });
    });

    it('stores the email in lowercase', async () => {
      const response = await register({ ...chloe, email: 'Chloe.Petit@Castelmont.FR' }).expect(201);
      const profile = await me(response.body.access_token).expect(200);
      expect(profile.body.email).toBe('chloe.petit@castelmont.fr');
    });

    it.each(['chloe.petit@gmail.com', 'chloe.petit@castelmont.fr.example.com'])(
      'answers 400 for %s, outside the school domain',
      async (email) => {
        await register({ ...chloe, email }).expect(400);
        expect(await prisma.user.count()).toBe(0);
      },
    );

    it('answers 409 when the email is already used, whatever its case', async () => {
      await register(chloe).expect(201);
      await register(chloe).expect(409);
      await register({ ...chloe, email: 'CHLOE.PETIT@castelmont.fr' }).expect(409);
      expect(await prisma.user.count()).toBe(1);
    });

    it('answers 400 for a password of 7 characters', async () => {
      await register({ ...chloe, password: '1234567' }).expect(400);
    });

    it('answers 400 when the body tries to set the role', async () => {
      await register({ ...chloe, role: 'referent' }).expect(400);
      expect(await prisma.user.count()).toBe(0);
    });

    it.each([
      ['an empty first name', { firstName: '' }],
      ['an empty last name', { lastName: '' }],
      ['a first name of 51 characters', { firstName: 'a'.repeat(51) }],
      ['a last name of 51 characters', { lastName: 'a'.repeat(51) }],
      ['an email without a local part', { email: '@castelmont.fr' }],
      ['a password of 129 characters', { password: 'a'.repeat(129) }],
    ])('answers 400 for %s', async (_case, override) => {
      await register({ ...chloe, ...override }).expect(400);
    });
  });

  describe('POST /auth/login', () => {
    function login(body: object) {
      return request(app.getHttpServer()).post('/auth/login').send(body);
    }

    beforeEach(async () => {
      await createUser(prisma, { email: 'alice.martin@castelmont.fr' });
    });

    it('returns a token for the right password', async () => {
      const response = await login({ email: 'alice.martin@castelmont.fr', password: TEST_PASSWORD }).expect(200);
      expect(response.body).toEqual({ access_token: expect.any(String) });
      expect(response.body.access_token.split('.')).toHaveLength(3);
    });

    it('accepts the email in any case', async () => {
      await login({ email: 'Alice.Martin@Castelmont.fr', password: TEST_PASSWORD }).expect(200);
    });

    it('answers 401 with the same message for a wrong password and an unknown email', async () => {
      const wrongPassword = await login({ email: 'alice.martin@castelmont.fr', password: 'wrong-password' }).expect(401);
      const unknownEmail = await login({ email: 'nobody@castelmont.fr', password: TEST_PASSWORD }).expect(401);
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it.each([
      ['an invalid email', { email: 'alice.martin', password: TEST_PASSWORD }],
      ['an empty password', { email: 'alice.martin@castelmont.fr', password: '' }],
      ['no password', { email: 'alice.martin@castelmont.fr' }],
    ])('answers 400 for %s', async (_case, body) => {
      await login(body).expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('answers 401 for a malformed token', async () => {
      await me('not.a.token').expect(401);
    });

    it('answers 401 for a token signed with another secret', async () => {
      const user = await createUser(prisma, { email: 'alice.martin@castelmont.fr' });
      const forged = await new JwtService({ secret: 'another-secret' }).signAsync({
        sub: user.id,
        email: user.email,
        role: 'referent',
      });
      await me(forged).expect(401);
    });

    it('tells a referent apart from a student, in the profile and in the token', async () => {
      await createUser(prisma, { email: 'referent1@castelmont.fr', role: 'referent', initiated: true });
      const token = await loginAs(app, 'referent1@castelmont.fr');

      const profile = await me(token).expect(200);
      expect(profile.body).toMatchObject({ role: 'referent', initiationValidated: true });
      expect(decodeToken(token)).toMatchObject({ role: 'referent' });
    });

    it('answers 401 when the account no longer exists', async () => {
      const user = await createUser(prisma, { email: 'alice.martin@castelmont.fr' });
      const token = await loginAs(app, 'alice.martin@castelmont.fr');
      await prisma.user.delete({ where: { id: user.id } });

      await me(token).expect(401);
    });
  });
});
