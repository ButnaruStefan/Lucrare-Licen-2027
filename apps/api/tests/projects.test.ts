/**
 * Teste pentru rutele de proiecte. Folosesc baza de date de test (`ro_a11y_test`),
 * golita inainte de fiecare test.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, projectListSchema, projectSchema } from '@ro-a11y/shared';
import { createTestApp } from './helpers/test-app';
import { resetDatabase, testDb } from './helpers/test-db';

const app = createTestApp({ db: testDb });

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

describe('POST /api/v1/projects', () => {
  it('creeaza un proiect si raspunde 201, cu datele curatate', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .send({ name: '  Primaria Valea Verde  ', baseUrl: 'https://exemplu.ro#sus' });

    expect(res.status).toBe(201);
    const project = projectSchema.parse(res.body);
    expect(project.name).toBe('Primaria Valea Verde');
    expect(project.baseUrl).toBe('https://exemplu.ro/');
    expect(await testDb.project.count()).toBe(1);
  });

  it.each([
    ['fara protocol', 'exemplu.ro'],
    ['protocol nepermis', 'ftp://exemplu.ro'],
    ['javascript:', 'javascript:alert(1)'],
    ['cu utilizator si parola', 'https://admin:parola@exemplu.ro'],
  ])('respinge adresa %s cu 400 VALIDATION_ERROR', async (_caz, baseUrl) => {
    const res = await request(app).post('/api/v1/projects').send({ name: 'Test', baseUrl });

    expect(res.status).toBe(400);
    const { error } = apiErrorSchema.parse(res.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((d) => d.field)).toEqual(['baseUrl']);
    expect(await testDb.project.count()).toBe(0);
  });

  it('respinge un nume gol si arata ambele campuri gresite', async () => {
    const res = await request(app).post('/api/v1/projects').send({ name: '   ' });

    expect(res.status).toBe(400);
    const { error } = apiErrorSchema.parse(res.body);
    expect(error.details?.map((d) => d.field).sort()).toEqual(['baseUrl', 'name']);
  });

  it('respinge un corp care nu e JSON valid cu 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Content-Type', 'application/json')
      .send('{nu e json');

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('INVALID_JSON');
  });
});

describe('GET /api/v1/projects', () => {
  it('returneaza lista goala cand nu exista proiecte', async () => {
    const res = await request(app).get('/api/v1/projects');

    expect(res.status).toBe(200);
    expect(projectListSchema.parse(res.body).items).toEqual([]);
  });

  it('returneaza proiectele, cele mai noi primele', async () => {
    await testDb.project.create({
      data: { name: 'Vechi', baseUrl: 'https://vechi.ro/', createdAt: new Date('2026-01-01') },
    });
    await testDb.project.create({
      data: { name: 'Nou', baseUrl: 'https://nou.ro/', createdAt: new Date('2026-06-01') },
    });

    const res = await request(app).get('/api/v1/projects');

    expect(projectListSchema.parse(res.body).items.map((p) => p.name)).toEqual(['Nou', 'Vechi']);
  });
});

describe('GET /api/v1/projects/:projectId', () => {
  it('returneaza proiectul cerut', async () => {
    const created = await testDb.project.create({
      data: { name: 'Demo', baseUrl: 'https://demo.ro/' },
    });

    const res = await request(app).get(`/api/v1/projects/${created.id}`);

    expect(res.status).toBe(200);
    expect(projectSchema.parse(res.body).id).toBe(created.id);
  });

  it.each([
    ['un ID valid, dar inexistent', '00000000-0000-4000-8000-000000000000'],
    ['un ID cu forma gresita', 'nu-e-uuid'],
  ])('raspunde 404 PROJECT_NOT_FOUND pentru %s', async (_caz, id) => {
    const res = await request(app).get(`/api/v1/projects/${id}`);

    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('PROJECT_NOT_FOUND');
  });
});
