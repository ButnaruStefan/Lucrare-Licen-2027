/**
 * Teste pentru rutele de sanatate si pentru formatul erorilor.
 *
 * Aplicatia e creata cu dependente false: un logger silentios si o verificare a bazei
 * de date care reuseste sau esueaza la comanda. Testele nu au nevoie de PostgreSQL:
 * rutele testate aici nu folosesc baza de date.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema, readyResponseSchema } from '@ro-a11y/shared';
import { createTestApp } from './helpers/test-app';

const dbOk = async () => {};
const dbDown = async () => {
  throw new Error('connection refused');
};

describe('GET /health', () => {
  it('raspunde 200 cu formatul din contract', async () => {
    const res = await request(createTestApp({ checkDatabase: dbOk })).get('/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body).status).toBe('ok');
  });
});

describe('GET /api/v1/health/ready', () => {
  it('raspunde 200 "ready" cand baza de date functioneaza', async () => {
    const res = await request(createTestApp({ checkDatabase: dbOk })).get('/api/v1/health/ready');

    expect(res.status).toBe(200);
    expect(readyResponseSchema.parse(res.body)).toEqual({
      status: 'ready',
      checks: { database: 'ok' },
    });
  });

  it('raspunde 503 "not_ready" cand baza de date nu raspunde', async () => {
    const res = await request(createTestApp({ checkDatabase: dbDown })).get('/api/v1/health/ready');

    expect(res.status).toBe(503);
    expect(readyResponseSchema.parse(res.body)).toEqual({
      status: 'not_ready',
      checks: { database: 'error' },
    });
  });
});

describe('Rute inexistente', () => {
  it('raspund 404 in formatul standard de eroare, cu request ID', async () => {
    const res = await request(createTestApp({ checkDatabase: dbOk })).get('/nu-exista');

    expect(res.status).toBe(404);
    const body = apiErrorSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
  });
});
