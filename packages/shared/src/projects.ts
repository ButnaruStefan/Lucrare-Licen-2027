/**
 * Contractul pentru proiecte (un proiect = un site analizat).
 *
 * - `createProjectSchema` validează ce trimite utilizatorul când creează un proiect.
 * - `projectSchema` descrie un proiect, așa cum îl returnează API-ul.
 *
 * Validarea adresei de aici e doar de formă (http/https, fără parolă în adresă). Verificarea
 * de securitate completă (fără rețele interne, fără localhost) se face înainte de scanare (S2).
 */
import { z } from 'zod';

const MAX_URL_LENGTH = 2048;

/** O adresă web acceptabilă ca adresă de bază a unui proiect. */
export const projectUrlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH, { message: `Adresa poate avea cel mult ${MAX_URL_LENGTH} de caractere.` })
  .transform((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Adresa nu este validă (ex. https://exemplu.ro).' });
      return z.NEVER;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      ctx.addIssue({ code: 'custom', message: 'Sunt acceptate doar adrese http:// sau https://.' });
      return z.NEVER;
    }
    if (url.username || url.password) {
      ctx.addIssue({ code: 'custom', message: 'Adresa nu poate conține utilizator sau parolă.' });
      return z.NEVER;
    }
    url.hash = ''; // fragmentul (#...) nu schimbă pagina încărcată
    return url.toString();
  });

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Numele este obligatoriu.' })
    .max(120, { message: 'Numele poate avea cel mult 120 de caractere.' }),
  baseUrl: projectUrlSchema,
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Project = z.infer<typeof projectSchema>;

export const projectListSchema = z.object({
  items: z.array(projectSchema),
});
export type ProjectList = z.infer<typeof projectListSchema>;
