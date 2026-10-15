/**
 * Punctul de intrare al frontendului: monteaza aplicatia React in elementul #root din index.html.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elementul #root lipseste din index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
