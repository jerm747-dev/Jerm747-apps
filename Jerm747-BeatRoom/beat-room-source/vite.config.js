import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps the build portable, so dist/ can live in any folder on jerm747.com or jerm747.dev.
export default defineConfig({
  // the build number from package.json (bumped by npm run build), shown in the footer
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version) },
  base: './',
  plugins: [react()],
  server: { host: true },
});
