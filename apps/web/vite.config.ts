/**
 * Configurarea Vite (serverul de dezvoltare și build-ul frontendului).
 *
 * `proxy`: în dezvoltare, cererile către /api și /health sunt trimise mai departe la
 * API (portul 3000). Browserul vorbește doar cu Vite (portul 5173), deci nu e nevoie de CORS.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/health': apiTarget,
    },
  },
});
