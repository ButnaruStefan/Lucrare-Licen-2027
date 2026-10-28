/**
 * Rutele pentru profilul juridic al unui proiect (OUG 112/2018):
 *
 * - GET /api/v1/projects/:projectId/legal-profile — intrebarile chestionarului si profilul
 *                                                   salvat (sau null daca nu a fost completat)
 * - PUT /api/v1/projects/:projectId/legal-profile — salveaza raspunsurile, le evalueaza si
 *                                                   returneaza profilul; 400 daca lipsesc raspunsuri
 *
 * Evaluarea e facuta de `evaluateOug112` din `@ro-a11y/catalog` si e salvata asa cum a fost
 * calculata (cu versiunea catalogului), ca rezultatul sa ramana acelasi si dupa ce catalogul
 * se schimba. Un nou PUT recalculeaza evaluarea.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  legalAssessmentSchema,
  legalProfileAnswersSchema,
  legalProfileSchema,
  type LegalProfile,
  type LegalProfileResponse,
} from '@ro-a11y/shared';
import { evaluateOug112, OUG_112_QUESTIONS } from '@ro-a11y/catalog';
import type { Database } from '../db/prisma';
import type { Prisma } from '../generated/prisma/client';
import { HttpError } from '../middleware/errors';
import { validate } from '../lib/validation';

export interface LegalProfileDeps {
  db: Database;
}

type LegalProfileRow = NonNullable<Awaited<ReturnType<Database['legalProfile']['findUnique']>>>;

/** Transforma randul din baza de date in forma din contract. */
export function toLegalProfileDto(row: LegalProfileRow): LegalProfile {
  return legalProfileSchema.parse({
    projectId: row.projectId,
    answers: row.answers,
    assessment: legalAssessmentSchema.parse(row.assessment),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function projectNotFound(): HttpError {
  return new HttpError(404, 'PROJECT_NOT_FOUND', 'Proiectul nu există.');
}

async function findProject(db: Database, projectId: string) {
  if (!z.uuid().safeParse(projectId).success) throw projectNotFound();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw projectNotFound();
  return project;
}

export function legalProfileRouter({ db }: LegalProfileDeps): Router {
  const router = Router();

  router.get('/api/v1/projects/:projectId/legal-profile', async (req, res) => {
    const project = await findProject(db, req.params.projectId);
    const row = await db.legalProfile.findUnique({ where: { projectId: project.id } });
    const body: LegalProfileResponse = {
      questions: OUG_112_QUESTIONS,
      profile: row ? toLegalProfileDto(row) : null,
    };
    res.json(body);
  });

  router.put('/api/v1/projects/:projectId/legal-profile', async (req, res) => {
    const project = await findProject(db, req.params.projectId);
    const answers = validate(legalProfileAnswersSchema, req.body);
    const assessment = evaluateOug112(answers);

    // Prisma cere pentru coloanele JSON o valoare JSON simpla; copia prin JSON garanteaza asta.
    const data = {
      answers: JSON.parse(JSON.stringify(answers)) as Prisma.InputJsonObject,
      status: assessment.status,
      assessment: JSON.parse(JSON.stringify(assessment)) as Prisma.InputJsonObject,
      catalogVersion: assessment.catalogVersion,
    };
    const row = await db.legalProfile.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, ...data },
      update: data,
    });
    res.json(toLegalProfileDto(row));
  });

  return router;
}
