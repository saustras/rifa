import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  root: path.join(workspaceRoot, 'apps/public-web'),
  plugins: [react()],
  resolve: {
    alias: {
      '@rifa/shared': path.join(workspaceRoot, 'packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/local-campaign-assets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: path.join(workspaceRoot, 'dist/apps/public-web'),
    emptyOutDir: true,
  },
});
