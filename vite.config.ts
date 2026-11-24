import { defineConfig } from 'vite';

const pagesBase = '/wwi-supply-chain-intelligence/';

export default defineConfig({
  base: process.env.VITE_DEPLOY_TARGET === 'github-pages' ? pagesBase : '/',
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
