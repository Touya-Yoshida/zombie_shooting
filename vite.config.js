import { defineConfig } from 'vite';

// On GitHub Pages this app is served at /zombie_shooting/, so absolute imports
// (and runtime fetches via import.meta.env.BASE_URL) need that prefix in
// production. Locally we keep the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/zombie_shooting/' : '/',
  server: {
    host: true,
    port: 5273,
    strictPort: false
  }
}));
