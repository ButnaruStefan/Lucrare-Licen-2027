/**
 * Rutele pentru proiecte (un proiect = un site analizat):
 *
 * - POST /api/v1/projects            — creeaza un proiect (nume + adresa), raspunde 201;
 *                                       409 PROJECT_EXISTS daca exista deja un proiect pentru
 *                                       aceeasi adresa (http/https si "/" final nu conteaza)
 * - GET  /api/v1/projects            — lista proiectelor, cele mai noi primele
 * - GET  /api/v1/projects/:projectId — un singur proiect, sau 404 daca nu exista
 *
 * Datele primite sunt validate cu schemele din `@ro-a11y/shared`, iar raspunsurile
 * respecta aceleasi contracte (datele calendaristice trimise ca text ISO).
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

/** Cat de multe proiecte returneaza lista (suficient pentru o aplicatie locala). */
const LIST_LIMIT = 100;

type ProjectRow = { id: string; name: string; baseUrl: string; createdAt: Date; updatedAt: Date };

/** Transforma randul din baza de date in forma din contract. */
function toProjectDto(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Variantele aceleiasi adrese, ca sa recunoastem un duplicat. Sunt considerate acelasi site:
 *   - http:// si https://;
 *   - calea cu sau fara "/" la final (ex. /broken si /broken/).
 * Adresa e deja normalizata de validare (fara #, cu "/" dupa domeniu).
 */
export function sameSiteVariants(baseUrl: string): string[] {
  const variants = new Set<string>();
  for (const protocol of ['https:', 'http:']) {
    const url = new URL(baseUrl);
    url.protocol = protocol;
    variants.add(url.toString());
    if (url.pathname !== '/') {
      url.pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : `${url.pathname}/`;
      variants.add(url.toString());
    }
  }
  return [...variants];
}

function projectNotFound(): HttpError {
  return new HttpError(404, 'PROJECT_NOT_FOUND', 'Proiectul nu există.');
}

export function projectsRouter({ db }: ProjectsDeps): Router {
  const router = Router();

  router.post('/api/v1/projects', async (req, res) => {
    const input = validate(createProjectSchema, req.body);

    const existing = await db.project.findFirst({
      where: { baseUrl: { in: sameSiteVariants(input.baseUrl) } },
    });
    if (existing) {
      throw new HttpError(
        409,
        'PROJECT_EXISTS',
        `Există deja un proiect pentru acest site: „${existing.name}”.`,
        [
          {
            field: 'baseUrl',
            message: `Există deja un proiect pentru acest site: „${existing.name}”.`,
          },
        ],
        existing.id,
      );
    }

    const created = await db.project.create({ data: input });
    res.status(201).json(toProjectDto(created));
  });

  router.get('/api/v1/projects', async (_req, res) => {
    const rows = await db.project.findMany({ orderBy: { createdAt: 'desc' }, take: LIST_LIMIT });
    const body: ProjectList = { items: rows.map(toProjectDto) };
    res.json(body);
  });

  router.get('/api/v1/projects/:projectId', async (req, res) => {
    // Un ID care nu are forma unui UUID nu poate exista: raspundem direct 404.
    if (!z.uuid().safeParse(req.params.projectId).success) throw projectNotFound();

    const row = await db.project.findUnique({ where: { id: req.params.projectId } });
    if (!row) throw projectNotFound();
    res.json(toProjectDto(row));
  });

  return router;
}
