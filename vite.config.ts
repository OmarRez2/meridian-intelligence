import { defineConfig } from 'vite';
// Local-only prototype. No proxy, no backend, no deployment target.
export default defineConfig({
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
