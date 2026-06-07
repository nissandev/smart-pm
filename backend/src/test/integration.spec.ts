/**
 * Integration tests — spins up the full NestJS app against an in-memory
 * MongoDB instance. No external services required.
 *
 * Pattern: use UsersService directly for test-data setup (avoids hitting
 * rate limits), and use supertest HTTP requests for the actual assertions.
 *
 * Run: npm test   (Jest picks up *.spec.ts automatically)
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.schema';

// ── helpers ────────────────────────────────────────────────────────────────

function futureDate(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

// ── test suite ─────────────────────────────────────────────────────────────

describe('Integration tests', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  let adminToken: string;
  let memberToken: string;
  let projectId: string;
  let taskId: string;

  // ── bootstrap ─────────────────────────────────────────────────────────────
  // Create users via UsersService (bypasses HTTP rate limiting).
  // Tokens are obtained via login so they carry the correct JWT role claim.

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    process.env.JWT_SECRET = 'integration-test-secret-32chars!!';
    process.env.ALLOW_PUBLIC_REGISTER = 'true';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    // Seed: admin + member — created via service layer, not HTTP
    const usersService = moduleRef.get<UsersService>(UsersService);
    await usersService.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'SecurePass1',
      role: UserRole.ADMIN,
    });
    await usersService.create({
      name: 'Team Member',
      email: 'member@test.com',
      password: 'SecurePass1',
      role: UserRole.MEMBER,
    });

    // Log in via HTTP to get real JWTs with correct role claims
    const [adminLogin, memberLogin] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'SecurePass1' }),
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'member@test.com', password: 'SecurePass1' }),
    ]);

    adminToken = adminLogin.body.token;
    memberToken = memberLogin.body.token;
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  // ── Auth: register (public endpoint) ──────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('creates a new account and returns token + sanitized user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'New User', email: 'newuser@test.com', password: 'SecurePass1' })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('newuser@test.com');
      expect(res.body.user.password).toBeUndefined();
    });

    it('rejects duplicate email with 409', () =>
      request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Dup', email: 'newuser@test.com', password: 'SecurePass1' })
        .expect(409));
  });

  // ── Auth: login ───────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'SecurePass1' })
        .expect(201);
      expect(res.body.token).toBeDefined();
    });

    it('rejects wrong password with 401', () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrongpassword' })
        .expect(401));

    it('rejects unknown email with 401', () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'SecurePass1' })
        .expect(401));
  });

  // ── Auth: /me ─────────────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('returns the current user when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.email).toBe('admin@test.com');
      expect(res.body.password).toBeUndefined();
    });

    it('returns 401 without a token', () =>
      request(app.getHttpServer()).get('/api/auth/me').expect(401));

    it('returns 401 for a malformed token', () =>
      request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401));
  });

  // ── Projects ──────────────────────────────────────────────────────────────

  describe('Projects', () => {
    it('POST /api/projects — creates a project', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Alpha Project', deadline: futureDate(30), status: 'Active' })
        .expect(201);

      expect(res.body.name).toBe('Alpha Project');
      expect(res.body._id).toBeDefined();
      projectId = res.body._id;
    });

    it('POST /api/projects — rejects missing deadline with 400', () =>
      request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No Deadline' })
        .expect(400));

    it('GET /api/projects — returns paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/projects?search=Alpha — server-side search filters correctly', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/projects?search=Alpha')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.every((p: any) => /alpha/i.test(p.name))).toBe(true);
    });

    it('GET /api/projects?search=zzznomatch — returns empty data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/projects?search=zzznomatch')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });

    it('GET /api/projects/:id — returns single project', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body._id).toBe(projectId);
    });

    it('PATCH /api/projects/:id — updates the project', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Alpha Project Updated', deadline: futureDate(60) })
        .expect(200);
      expect(res.body.name).toBe('Alpha Project Updated');
    });
  });

  // ── Tasks ─────────────────────────────────────────────────────────────────

  describe('Tasks', () => {
    it('POST /api/tasks — creates a task', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'First Task', project: projectId, dueDate: futureDate(7), priority: 'High' })
        .expect(201);

      expect(res.body.title).toBe('First Task');
      expect(res.body.priority).toBe('High');
      taskId = res.body._id;
    });

    it('POST /api/tasks — rejects duplicate title in same project with 409', () =>
      request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'First Task', project: projectId, dueDate: futureDate(7), priority: 'Low' })
        .expect(409));

    it('GET /api/tasks — returns paginated tasks', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/tasks?search=First — server-side search works', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tasks?search=First')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.every((t: any) => /first/i.test(t.title))).toBe(true);
    });

    it('PATCH /api/tasks/:id — updates status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'In Progress' })
        .expect(200);
      expect(res.body.status).toBe('In Progress');
    });

    it('DELETE /api/tasks/:id — removes the task', () =>
      request(app.getHttpServer())
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200));
  });

  // ── RBAC enforcement ──────────────────────────────────────────────────────

  describe('RBAC enforcement', () => {
    it('member cannot list users — 403', () =>
      request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403));

    it('member cannot delete a project — 403', () =>
      request(app.getHttpServer())
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403));

    it('unauthenticated request returns 401', () =>
      request(app.getHttpServer()).get('/api/projects').expect(401));
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────

  describe('Dashboard', () => {
    it('GET /api/dashboard — returns expected shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('projects');
      expect(res.body).toHaveProperty('tasks');
      expect(res.body).toHaveProperty('tasksByPriority');
      expect(res.body).toHaveProperty('memberWorkload');
    });

    it('GET /api/dashboard — second call is served from cache (< 200ms)', async () => {
      const t0 = Date.now();
      await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Date.now() - t0).toBeLessThan(200);
    });
  });

  // ── Health ────────────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('returns 200 with status ok and mongo connected', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.mongo).toBe('connected');
    });
  });
});
