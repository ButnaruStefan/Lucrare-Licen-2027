/**
 * Titlul principal al unei pagini (<h1>) + titlul din fila browserului.
 *
 * Accesibilitate: intr-o aplicatie cu o singura pagina (SPA), browserul nu anunta singur ca s-a
 * schimbat pagina. De aceea, dupa fiecare navigare, mutam focusul pe titlu: cititorul de ecran
 * il citeste, iar utilizatorul de tastatura continua de la inceputul continutului nou.
 * La prima incarcare a aplicatiei nu mutam focusul (ar fi neasteptat).
 *
 * Doar schimbarea PAGINII (calea din adresa) muta focusul. Filtrele scriu si ele in adresa
 * (ex. ?cauta=img), dar acelea nu sunt o pagina noua: daca am muta focusul si atunci, la tastarea
 * in campul de cautare focusul ar sari pe titlu dupa prima litera.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';

const APP_NAME = 'W4A';

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const location = useLocation();

  useEffect(() => {
    document.title = `${title} — ${APP_NAME}`;
  }, [title]);

  useEffect(() => {
    // "default" = prima pagina deschisa; la navigarile urmatoare, cheia e alta
    if (location.key !== 'default') ref.current?.focus();
    // Efectul depinde doar de cale: o schimbare a filtrelor din adresa nu muta focusul.
  }, [location.pathname]);

  return (
    <h1 ref={ref} tabIndex={-1} className="page-heading">
      {children ?? title}
    </h1>
  );
}
