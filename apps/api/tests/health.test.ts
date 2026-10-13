/**
 * Teste pentru rutele de sănătate și pentru formatul erorilor.
 *
 * Aplicația e creată cu dependențe false: un logger silențios și o verificare a bazei
 * de date care reușește sau eșuează la comandă. Testele nu au nevoie de PostgreSQL.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema, readyResponseSchema } from '@ro-a11y/shared';
import { createApp } from '../src/app';
import { createLogger } from '../src/lib/logger';

const logger = createLogger('silent');
const dbOk = async () => {};
const dbDown = async () => {
  throw new Error('connection refused');
};

describe('GET /health', () => {
  it('răspunde 200 cu formatul din contract', async () => {
    const res = await request(createApp({ logger, checkDatabase: dbOk })).get('/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body).status).toBe('ok');
  });
});

describe('GET /api/v1/health/ready', () => {
  it('răspunde 200 „ready” când baza de date funcționează', async () => {
    const res = await request(createApp({ logger, checkDatabase: dbOk })).get(
      '/api/v1/health/ready',
    );

    expect(res.status).toBe(200);
    expect(readyResponseSchema.parse(res.body)).toEqual({
      status: 'ready',
      checks: { database: 'ok' },
    });
  });

  it('răspunde 503 „not_ready” când baza de date nu răspunde', async () => {
    const res = await request(createApp({ logger, checkDatabase: dbDown })).get(
      '/api/v1/health/ready',
    );

    expect(res.status).toBe(503);
    expect(readyResponseSchema.parse(res.body)).toEqual({
      status: 'not_ready',
      checks: { database: 'error' },
    });
  });
});

describe('Rute inexistente', () => {
  it('răspund 404 în formatul standard de eroare, cu request ID', async () => {
    const res = await request(createApp({ logger, checkDatabase: dbOk })).get('/nu-exista');

    expect(res.status).toBe(404);
    const body = apiErrorSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
  });
});
