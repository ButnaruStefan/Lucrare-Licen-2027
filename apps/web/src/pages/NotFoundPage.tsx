/**
 * Pagina afisata pentru orice adresa necunoscuta din aplicatie.
 */
import { Link } from 'react-router';
import { PageHeading } from '../components/PageHeading';

export function NotFoundPage() {
  return (
    <>
      <PageHeading title="Pagina nu există" />
      <p>Adresa accesată nu corespunde niciunei pagini din aplicație.</p>
      <p>
        <Link to="/">Mergi la lista de proiecte</Link>
      </p>
    </>
  );
}
