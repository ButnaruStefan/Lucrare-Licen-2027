/**
 * Mutarea focusului pe primul camp gresit al unui formular, dupa o trimitere esuata.
 *
 * Folosit de formularele de proiect, de scanare si de profil juridic.
 *
 * De ce intr-un efect (useEffect) si nu imediat dupa raspunsul serverului: campul e marcat
 * gresit (aria-invalid="true") abia cand React deseneaza din nou formularul. Efectul ruleaza
 * DUPA acest desen, deci campul exista sigur. Varianta veche (requestAnimationFrame) putea rula
 * inainte de desen pe un calculator incarcat, iar atunci focusul nu se mai muta deloc.
 *
 * `trigger` = orice valoare care se schimba la fiecare trimitere esuata (ex. obiectul erorii sau
 * un contor). Cand e "fals" (null, 0), nu se intampla nimic.
 */
import { useEffect, type RefObject } from 'react';

export function useFocusFirstInvalid(formRef: RefObject<HTMLElement | null>, trigger: unknown) {
  useEffect(() => {
    if (!trigger) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [formRef, trigger]);
}
