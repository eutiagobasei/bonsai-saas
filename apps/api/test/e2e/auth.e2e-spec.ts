import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../helpers/test-database.helper';
import { PrismaService } from '../../src/common/database/prisma.service';
import { testUsers, TEST_PASSWORD } from '../fixtures/users.fixture';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cleanup: () => Promise<void>;
  let registeredUser: { accessToken: string; cookies: string[] };

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    cleanup = testApp.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await prisma.cleanDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUsers.newUser.email,
          password: testUsers.newUser.password,
          name: testUsers.newUser.name,
          tenantName: testUsers.newUser.tenantName,
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('refreshToken'); // Should be in cookie
      expect(response.body.user.email).toBe(testUsers.newUser.email);
      expect(response.body.tenant).toBeDefined();

      // Check for HttpOnly cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('refreshToken'))).toBe(true);
      expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);

      registeredUser = {
        accessToken: response.body.accessToken,
        cookies: cookies,
      };
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUsers.newUser.email,
          password: testUsers.newUser.password,
        })
        .expect(201);

      // Duplicate registration
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUsers.newUser.email,
          password: testUsers.newUser.password,
        })
        .expect(400);
    });

    it('should validate email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: testUsers.newUser.password,
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user first
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUsers.owner.email,
          password: TEST_PASSWORD,
          name: testUsers.owner.name,
        });

      registeredUser = {
        accessToken: response.body.accessToken,
        cookies: response.headers['set-cookie'],
      };
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUsers.owner.email,
          password: TEST_PASSWORD,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUsers.owner.email);

      // Check for HttpOnly cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies.some((c: string) => c.includes('refreshToken'))).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUsers.owner.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: TEST_PASSWORD,
        })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUsers.owner.email,
          password: TEST_PASSWORD,
        });

      registeredUser = {
        accessToken: response.body.accessToken,
        cookies: response.headers['set-cookie'],
      };
    });

    it('should refresh tokens using cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', registeredUser.cookies)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('refreshToken');
    });

    it('should reject request without refresh token cookie', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUsers.owner.email,
          password: TEST_PASSWORD,
        });

      registeredUser = {
        accessToken: response.body.accessToken,
        cookies: response.headers['set-cookie'],
      };
    });

    it('should logout and clear cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${registeredUser.accessToken}`)
        .set('Cookie', registeredUser.cookies)
        .expect(204);

      // Check cookie was cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies.some((c: string) => c.includes('refreshToken=;'))).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(401);
    });
  });
});
