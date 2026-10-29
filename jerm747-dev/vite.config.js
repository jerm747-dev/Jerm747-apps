import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `npm run dev`, API calls go to a local PHP server:  php -S localhost:8000 -t public
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' } },
});
