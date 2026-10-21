import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const sharedSrcDir = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolve the workspace package straight from TypeScript source so the
    // dashboard never depends on a stale `packages/shared/dist` build.
    alias: [
      { find: /^@hookrelay\/shared$/, replacement: `${sharedSrcDir}/index.ts` },
      { find: /^@hookrelay\/shared\//, replacement: `${sharedSrcDir}/` },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
