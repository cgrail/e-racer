import { defineConfig } from 'vite';

// Relative base so the built game runs from any sub-path (e.g. GitHub Pages).
// In development, online races go through to the race server (npm run server) on its default port.
export default defineConfig({
  base: './',
  server: { proxy: { '/ws': { target: 'ws://localhost:8090', ws: true } } },
});
