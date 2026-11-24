/**
 * Ce contine pagina, numarat din DOM la scanare (imediat dupa axe-core, in aceeasi sesiune):
 * imaginile, formularele si campurile lor, titlurile (h1-h6 si role=heading), in ordine.
 *
 * Folosit de `page-scan.ts`; rezultatul se salveaza in `scans.page_facts`. Decide ce
 * verificari manuale nu se aplica pe pagina (ex. fara campuri de formular, verificarea erorilor
 * din formulare nu se aplica) si ii arata omului pe ce sa se uite (lista titlurilor).
 *
 * Numaram tot ce e in DOM, chiar ascuns (ex. un formular dintr-un meniu inchis): e mai sigur sa
 * lasam o verificare de facut decat sa spunem gresit ca nu se aplica. Ce apare abia dupa o
 * actiune (un formular adus la clic) nu se vede aici; de aceea omul poate schimba rezultatul.
 */
import type { Page } from 'playwright';
import { pageFactsSchema, type PageFacts } from '@ro-a11y/shared';

/** Cate titluri pastram, cel mult (o pagina normala are cateva zeci). */
export const MAX_HEADINGS = 100;
/** Cate caractere pastram din textul unui titlu. */
const MAX_HEADING_TEXT = 120;

export const PAGE_FACTS_SCRIPT = `((maxHeadings, maxText) => {
  const all = (selector) => [...document.querySelectorAll(selector)];
  const rendered = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const images = all('img, input[type="image" i], area[href], [role="img"]').length;
  const forms = all("form").length;
  const NOT_FIELDS = ["hidden", "submit", "button", "reset", "image"];
  const fields = all('input, select, textarea, [role="textbox"], [role="combobox"], [role="searchbox"], [role="spinbutton"]')
    .filter((el) => el.tagName !== "INPUT" || !NOT_FIELDS.includes((el.getAttribute("type") || "text").toLowerCase()));
  const headings = [];
  let truncated = false;
  for (const el of all('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
    if (headings.length >= maxHeadings) {
      truncated = true;
      break;
    }
    const fromTag = /^H([1-6])$/.exec(el.tagName);
    const ariaLevel = parseInt(el.getAttribute("aria-level") || "", 10);
    // role="heading" fara aria-level are nivelul 2 (specificatia ARIA)
    const level = el.getAttribute("role") === "heading"
      ? (ariaLevel >= 1 && ariaLevel <= 6 ? ariaLevel : 2)
      : (ariaLevel >= 1 && ariaLevel <= 6 ? ariaLevel : Number(fromTag ? fromTag[1] : 2));
    const text = (el.textContent || "").trim().replace(/\\s+/g, " ");
    headings.push({
      level,
      text: text.length > maxText ? text.slice(0, maxText) + "…" : text,
      hidden: !rendered(el),
    });
  }
  return { images, forms, formFields: fields.length, headings, headingsTruncated: truncated };
})`;

/** Numara ce contine pagina deschisa (null = nu s-a putut; scanarea ramane valida). */
export async function collectPageFacts(page: Page): Promise<PageFacts | null> {
  try {
    const raw = await page.evaluate(`${PAGE_FACTS_SCRIPT}(${MAX_HEADINGS}, ${MAX_HEADING_TEXT})`);
    return pageFactsSchema.parse(raw);
  } catch {
    return null;
  }
}
