import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds to plain static files in web/dist — serve that folder with Nginx/Caddy.
export default defineConfig({
  plugins: [react()],
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
  server: { port: 5173, host: true },
});
