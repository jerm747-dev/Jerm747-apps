import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps the build portable, so dist/ can live in any folder on jerm747.com or jerm747.dev.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
});
