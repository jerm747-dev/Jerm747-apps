import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds dist/index.html as ONE self-contained file (three.js + meshoptimizer inlined),
// so it opens from your desktop with no internet connection.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2020', chunkSizeWarningLimit: 4000 }
});
