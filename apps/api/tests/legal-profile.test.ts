/**
 * Teste pentru rutele profilului juridic (OUG 112/2018). Folosesc baza de date de test
 * (`ro_a11y_test`), golita inainte de fiecare test.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, legalProfileResponseSchema, legalProfileSchema } from '@ro-a11y/shared';
import { createTestApp } from './helpers/test-app';
import { resetDatabase, testDb } from './helpers/test-db';

const app = createTestApp({ db: testDb });

beforeEach(resetDatabase);
afterAll(() => testDb.$disconnect());

async function createProject() {
  return testDb.project.create({ data: { name: 'Primaria Test', baseUrl: 'https://exemplu.ro/' } });
}

const publicAuthority = {
  organizationType: 'public_authority',
  publicBroadcaster: 'no',
  audience: 'public',
};

describe('GET /api/v1/projects/:projectId/legal-profile', () => {
  it('trimite intrebarile si profil null cand nu a fost completat', async () => {
    const project = await createProject();

    const res = await request(app).get(`/api/v1/projects/${project.id}/legal-profile`);

    expect(res.status).toBe(200);
    const body = legalProfileResponseSchema.parse(res.body);
    expect(body.profile).toBeNull();
    expect(body.questions.map((q) => q.id)).toContain('organizationType');
  });

  it.each([['nu-e-uuid'], ['00000000-0000-4000-8000-000000000000']])(
    'raspunde 404 pentru proiectul %s',
    async (projectId) => {
      const res = await request(app).get(`/api/v1/projects/${projectId}/legal-profile`);
      expect(res.status).toBe(404);
      expect(apiErrorSchema.parse(res.body).error.code).toBe('PROJECT_NOT_FOUND');
    },
  );
});

describe('PUT /api/v1/projects/:projectId/legal-profile', () => {
  it('salveaza raspunsurile si evaluarea, apoi le returneaza la GET', async () => {
    const project = await createProject();

    const res = await request(app)
      .put(`/api/v1/projects/${project.id}/legal-profile`)
      .send(publicAuthority);

    expect(res.status).toBe(200);
    const profile = legalProfileSchema.parse(res.body);
    expect(profile.assessment.status).toBe('applicable');
    expect(profile.answers).toEqual(publicAuthority);

    const row = await testDb.legalProfile.findUniqueOrThrow({ where: { projectId: project.id } });
    expect(row.status).toBe('applicable');
    expect(row.catalogVersion).toBe(profile.assessment.catalogVersion);

    const get = legalProfileResponseSchema.parse(
      (await request(app).get(`/api/v1/projects/${project.id}/legal-profile`)).body,
    );
    expect(get.profile?.assessment.status).toBe('applicable');
  });

  it('un al doilea PUT inlocuieste profilul (un singur profil pe proiect)', async () => {
    const project = await createProject();
    const url = `/api/v1/projects/${project.id}/legal-profile`;

    await request(app).put(url).send(publicAuthority).expect(200);
    const res = await request(app).put(url).send({ organizationType: 'private' });

    expect(legalProfileSchema.parse(res.body).assessment.status).toBe('not_applicable');
    expect(await testDb.legalProfile.count()).toBe(1);
  });

  it('respinge raspunsurile incomplete cu 400 si numeste intrebarile lipsa', async () => {
    const project = await createProject();

    const res = await request(app)
      .put(`/api/v1/projects/${project.id}/legal-profile`)
      .send({ organizationType: 'public_authority' });

    expect(res.status).toBe(400);
    const { error } = apiErrorSchema.parse(res.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((d) => d.field).sort()).toEqual(['audience', 'publicBroadcaster']);
    expect(await testDb.legalProfile.count()).toBe(0);
  });

  it('profilul se sterge odata cu proiectul', async () => {
    const project = await createProject();
    await request(app)
      .put(`/api/v1/projects/${project.id}/legal-profile`)
      .send(publicAuthority)
      .expect(200);

    await testDb.project.delete({ where: { id: project.id } });

    expect(await testDb.legalProfile.count()).toBe(0);
  });
});
