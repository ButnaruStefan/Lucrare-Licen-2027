/**
 * Punctul de intrare al frontendului: porneste aplicatia React in elementul #root din index.html,
 * cu cele doua "furnizoare" globale: cache-ul de date (TanStack Query) si traseele (React Router).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // O singura reincercare la eroare: o eroare reala (ex. 404) trebuie afisata repede.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Elementul #root lipseste din index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
