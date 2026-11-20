/**
 * Contractul pentru verificarea aspectului paginii (separata complet de WCAG si de legislatie).
 *
 * Scannerul ingusteaza fereastra browserului pas cu pas (1400 -> 320 px, plus breakpoint-urile
 * paginii) si compara aranjarea paginii cu ea insasi, la latimi vecine (metoda din lucrarea
 * ReDeCheck, Walsh, Kapfhammer, McMinn, ISSTA 2017). Fiecare defect gasit e un "semnal de
 * aspect", cu un nivel:
 *   - visible:  sigur se vede (ex. pagina se deruleaza pe orizontala);
 *   - possible: probabil un defect; omul confirma privind captura;
 *   - info:     doar informatie.
 *
 * Folosit de API (raspunsul GET /api/v1/scans/:id/layout) si de interfata (sectiunea
 * "Aspect si afisare" de pe pagina scanarii).
 */
import { z } from 'zod';
import { elementBoxSchema } from './scans';

/**
 * Tipurile de semnale:
 *   - derulare-orizontala:       pagina se deruleaza pe lateral (un element iese din pagina);
 *   - taiat-la-marginea-paginii: un element e taiat de marginea paginii (fara derulare);
 *   - elemente-suprapuse:        doua elemente separate la latime mai mare intra unul peste altul;
 *   - iese-din-container:        continutul iese din containerul lui si e taiat (overflow hidden);
 *   - media-queries-suprapuse:   doua reguli CSS (max-width: N si min-width: N) active la N px;
 *   - fara-meta-viewport:        lipseste meta viewport (pe telefon, pagina apare micsorata);
 *   - meta-viewport-latime-fixa: meta viewport cu latime fixa in loc de device-width.
 */
export const LAYOUT_ISSUE_KINDS = [
  'derulare-orizontala',
  'taiat-la-marginea-paginii',
  'elemente-suprapuse',
  'iese-din-container',
  'media-queries-suprapuse',
  'fara-meta-viewport',
  'meta-viewport-latime-fixa',
] as const;
export type LayoutIssueKind = (typeof LAYOUT_ISSUE_KINDS)[number];

export const LAYOUT_LEVELS = ['visible', 'possible', 'info'] as const;
export type LayoutLevel = (typeof LAYOUT_LEVELS)[number];

/** Un element implicat intr-un semnal: cum il gasesti si cum arata. */
export const layoutElementSchema = z.object({
  selector: z.string(),
  htmlSnippet: z.string(),
  /** Inceputul textului vizibil, ca utilizatorul sa recunoasca elementul. */
  text: z.string().nullable(),
});
export type LayoutElement = z.infer<typeof layoutElementSchema>;

/** Detalii masurate, dupa tipul semnalului (toate optionale). */
export const layoutDetailsSchema = z.object({
  /** Cu cati pixeli iese elementul (din pagina sau din container). */
  overflowPx: z.number().optional(),
  /** Latimea paginii, in pixeli, la latimea ferestrei unde apare derularea. */
  pageWidth: z.number().optional(),
  /** Cat se suprapun elementele, in pixeli (latime x inaltime). */
  overlap: z.object({ width: z.number(), height: z.number() }).optional(),
  /** Media queries suprapuse: textul celor doua reguli si fisierele lor. */
  rules: z.array(z.object({ text: z.string(), source: z.string().nullable() })).optional(),
  /** Continutul meta viewport gasit. */
  metaViewport: z.string().optional(),
  /** Unde e marginea ferestrei in captura (px de la stanga capturii), daca se vede in ea. */
  edgeX: z.number().optional(),
  /**
   * Capetele intervalului de latimi sunt aproximative (latimile masurate din 60 in 60 px):
   * cautarea capetelor exacte nu s-a mai facut, pentru ca s-a terminat timpul verificarii.
   */
  approximate: z.boolean().optional(),
});
export type LayoutDetails = z.infer<typeof layoutDetailsSchema>;

export const layoutIssueSchema = z.object({
  id: z.string(),
  kind: z.enum(LAYOUT_ISSUE_KINDS),
  level: z.enum(LAYOUT_LEVELS),
  /** Intervalul de latimi ale ferestrei (px) la care apare; null = nu depinde de latime. */
  widthMin: z.number().int().nullable(),
  widthMax: z.number().int().nullable(),
  elements: z.array(layoutElementSchema),
  details: layoutDetailsSchema,
  /** Captura decupata in jurul elementelor, la latimea problemei (null = fara captura). */
  image: z
    .object({
      url: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      /** Latimea ferestrei la care a fost facuta captura. */
      viewportWidth: z.number().int(),
    })
    .nullable(),
  /** Chenarele elementelor, in pixeli, fata de coltul capturii. */
  boxes: z.array(elementBoxSchema),
});
export type LayoutIssue = z.infer<typeof layoutIssueSchema>;

/** Un breakpoint gasit in CSS-ul paginii (o conditie min-width / max-width / width). */
export const breakpointSchema = z.object({
  feature: z.enum(['min-width', 'max-width', 'width']),
  px: z.number(),
  /** Textul complet al media query, ex. "(min-width: 768px) and (max-width: 1023px)". */
  text: z.string(),
  /** Fisierul CSS din care vine (null = stil scris direct in pagina). */
  source: z.string().nullable(),
});
export type Breakpoint = z.infer<typeof breakpointSchema>;

/** Verificarea aspectului unei pagini, asa cum o returneaza API-ul. */
export const scanLayoutSchema = z.object({
  /** Latimile ferestrei verificate, de la cea mai mare la cea mai mica. */
  widths: z.array(z.number().int()),
  breakpoints: z.array(breakpointSchema),
  /** Continutul meta viewport (null = lipseste). */
  metaViewport: z.string().nullable(),
  durationMs: z.number().int(),
  /** true = verificarea s-a oprit la limita de timp, inainte de toate latimile. */
  partial: z.boolean(),
  /** De ce nu s-a putut face verificarea (null = s-a facut). */
  error: z.string().nullable(),
  issues: z.array(layoutIssueSchema),
});
export type ScanLayout = z.infer<typeof scanLayoutSchema>;
