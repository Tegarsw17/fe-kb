import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds to plain static files in web/dist — serve that folder with Nginx/Caddy.
export default defineConfig({
  plugins: [react()],
  // shared code (types, i18n, farm logic) lives in ./shared, also used by ../mobile
  resolve: { alias: { '@kebun/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)) } },
  base: './', // works from any sub-folder on your VPS
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // keep three.js in its own file so phones that never open 3D don't download it
        manualChunks: { three: ['three'] },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    // `npm run dev`: forward /api to the live server (it has no CORS, so the browser must stay same-origin).
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'https://kebun.43-157-235-41.sslip.io', changeOrigin: true } },
  },
});
