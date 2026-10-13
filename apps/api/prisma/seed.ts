/**
 * Datele demo („seed”): adaugă în baza de date cele două proiecte care corespund
 * site-urilor de antrenament din `fixtures/`. Rulează cu `npm run db:seed`.
 *
 * Poate fi rulat de mai multe ori: un proiect existent (aceeași adresă) nu e dublat.
 */
import 'dotenv/config';
import { createPrismaClient } from '../src/db/prisma';

const DEMO_PROJECTS = [
  { name: 'Demo: Valea Verde (accesibil)', baseUrl: 'http://localhost:4000/accessible/' },
  { name: 'Demo: Valea Verde (cu probleme)', baseUrl: 'http://localhost:4000/broken/' },
];

const db = createPrismaClient(process.env.DATABASE_URL!);

for (const project of DEMO_PROJECTS) {
  const existing = await db.project.findFirst({ where: { baseUrl: project.baseUrl } });
  if (existing) {
    console.log(`Există deja: ${project.name}`);
  } else {
    await db.project.create({ data: project });
    console.log(`Adăugat:     ${project.name}`);
  }
}

await db.$disconnect();
