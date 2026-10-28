/**
 * Datele demo ("seed"): adauga in baza de date cele doua proiecte care corespund
 * site-urilor de antrenament din `fixtures/`. Ruleaza cu `npm run db:seed`.
 *
 * Poate fi rulat de mai multe ori: un proiect existent (aceeasi adresa) nu e dublat.
 * In teorie pune niste date initiale ca sa putem testa.
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
    console.log(`Exista deja: ${project.name}`);
  } else {
    await db.project.create({ data: project });
    console.log(`Adaugat:     ${project.name}`);
  }
}

await db.$disconnect();
