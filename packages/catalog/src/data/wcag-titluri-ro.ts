/**
 * Titlurile in romana ale criteriilor WCAG de nivel A si AA (plus 4.1.1, inca prezent in
 * EN 301 549 V3.2.1).
 *
 * ATENTIE: este o traducere de lucru a autorului proiectului, NU o traducere oficiala W3C.
 * Interfata o afiseaza ca atare, langa titlul oficial in engleza (sursa de referinta).
 */
export const WCAG_TITLES_RO_STATUS = 'traducere de lucru a autorului (neoficială)';

export const WCAG_TITLES_RO: Record<string, string> = {
  // 1. Perceptibil
  '1.1.1': 'Conținut non-text',
  '1.2.1': 'Doar audio și doar video (preînregistrat)',
  '1.2.2': 'Subtitrări (preînregistrat)',
  '1.2.3': 'Audiodescriere sau alternativă media (preînregistrat)',
  '1.2.4': 'Subtitrări (în direct)',
  '1.2.5': 'Audiodescriere (preînregistrat)',
  '1.3.1': 'Informații și relații',
  '1.3.2': 'Secvență cu sens',
  '1.3.3': 'Caracteristici senzoriale',
  '1.3.4': 'Orientare',
  '1.3.5': 'Identificarea scopului unui câmp',
  '1.4.1': 'Utilizarea culorii',
  '1.4.2': 'Controlul sunetului',
  '1.4.3': 'Contrast (minim)',
  '1.4.4': 'Redimensionarea textului',
  '1.4.5': 'Imagini cu text',
  '1.4.10': 'Reașezarea conținutului (reflow)',
  '1.4.11': 'Contrastul elementelor non-text',
  '1.4.12': 'Spațierea textului',
  '1.4.13': 'Conținut la trecerea cursorului sau la focus',
  // 2. Operabil
  '2.1.1': 'Tastatură',
  '2.1.2': 'Fără capcană pentru tastatură',
  '2.1.4': 'Scurtături cu o singură tastă',
  '2.2.1': 'Timp ajustabil',
  '2.2.2': 'Pauză, oprire, ascundere',
  '2.3.1': 'Cel mult trei străfulgerări sau sub prag',
  '2.4.1': 'Ocolirea blocurilor',
  '2.4.2': 'Titlul paginii',
  '2.4.3': 'Ordinea focusului',
  '2.4.4': 'Scopul linkului (în context)',
  '2.4.5': 'Mai multe căi',
  '2.4.6': 'Titluri și etichete',
  '2.4.7': 'Focus vizibil',
  '2.4.11': 'Focus neacoperit (minim)',
  '2.5.1': 'Gesturi cu indicatorul',
  '2.5.2': 'Anularea acțiunii indicatorului',
  '2.5.3': 'Eticheta inclusă în nume',
  '2.5.4': 'Acționare prin mișcare',
  '2.5.7': 'Mișcări de tragere',
  '2.5.8': 'Dimensiunea țintei (minimă)',
  // 3. Inteligibil
  '3.1.1': 'Limba paginii',
  '3.1.2': 'Limba unor părți',
  '3.2.1': 'La primirea focusului',
  '3.2.2': 'La introducerea datelor',
  '3.2.3': 'Navigare consecventă',
  '3.2.4': 'Identificare consecventă',
  '3.2.6': 'Ajutor consecvent',
  '3.3.1': 'Identificarea erorilor',
  '3.3.2': 'Etichete sau instrucțiuni',
  '3.3.3': 'Sugestii pentru corectarea erorilor',
  '3.3.4': 'Prevenirea erorilor (juridic, financiar, date)',
  '3.3.7': 'Introducere redundantă',
  '3.3.8': 'Autentificare accesibilă (minimă)',
  // 4. Robust
  '4.1.1': 'Parsare (eliminat în WCAG 2.2)',
  '4.1.2': 'Nume, rol, valoare',
  '4.1.3': 'Mesaje de stare',
};
