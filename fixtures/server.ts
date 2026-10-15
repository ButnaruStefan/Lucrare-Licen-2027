/**
 * Porneste site-urile de antrenament pe http://localhost:4000 (`npm run dev:fixtures`).
 *
 *   /             -> pagina cu legaturi catre cele doua site-uri
 *   /accessible/  -> accessible-demo (varianta corecta)
 *   /broken/      -> broken-demo (varianta cu probleme intentionate)
 */
import { createFixturesServer } from './create-server';

const PORT = Number(process.env.FIXTURES_PORT ?? 4000);

createFixturesServer().listen(PORT, () => {
  console.log(`Site-uri de antrenament pornite pe http://localhost:${PORT}`);
  console.log(`  accesibil:   http://localhost:${PORT}/accessible/`);
  console.log(`  cu probleme: http://localhost:${PORT}/broken/`);
});
