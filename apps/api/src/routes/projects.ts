/**
 * Rutele pentru proiecte (un proiect = un site analizat):
 *
 * - POST /api/v1/projects            — creează un proiect (nume + adresă), răspunde 201
 * - GET  /api/v1/projects            — lista proiectelor, cele mai noi primele
 * - GET  /api/v1/projects/:projectId — un singur proiect, sau 404 dacă nu există
 *
 * Datele primite sunt validate cu schemele din `@ro-a11y/shared`, iar răspunsurile
 * respectă aceleași contracte (datele calendaristice trimise ca text ISO).
 */
import { Router } from 'express';
import { z } from 'zod';
import { createProjectSchema, type Project, type ProjectList } from '@ro-a11y/shared';
import type { Database } from '../db/prisma';
import { HttpError } from '../middleware/errors';
import { validate } from '../lib/validation';

export interface ProjectsDeps {
  db: Database;
}

/** Cât de multe proiecte returnează lista (suficient pentru o aplicație locală). */
const LIST_LIMIT = 100;

type ProjectRow = { id: string; name: string; baseUrl: string; createdAt: Date; updatedAt: Date };

/** Transformă rândul din baza de date în forma din contract. */
function toProjectDto(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function projectNotFound(): HttpError {
  return new HttpError(404, 'PROJECT_NOT_FOUND', 'Proiectul nu există.');
}

export function projectsRouter({ db }: ProjectsDeps): Router {
  const router = Router();

  router.post('/api/v1/projects', async (req, res) => {
    const input = validate(createProjectSchema, req.body);
    const created = await db.project.create({ data: input });
    res.status(201).json(toProjectDto(created));
  });

  router.get('/api/v1/projects', async (_req, res) => {
    const rows = await db.project.findMany({ orderBy: { createdAt: 'desc' }, take: LIST_LIMIT });
    const body: ProjectList = { items: rows.map(toProjectDto) };
    res.json(body);
  });

  router.get('/api/v1/projects/:projectId', async (req, res) => {
    // Un ID care nu are forma unui UUID nu poate exista: răspundem direct 404.
    if (!z.uuid().safeParse(req.params.projectId).success) throw projectNotFound();

    const row = await db.project.findUnique({ where: { id: req.params.projectId } });
    if (!row) throw projectNotFound();
    res.json(toProjectDto(row));
  });

  return router;
}
