import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  build: { outDir: 'web-dist', emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
