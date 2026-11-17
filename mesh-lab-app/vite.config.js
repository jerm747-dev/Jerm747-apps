import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import meshlabCLI from './cli/vite-plugin.mjs';

// Builds dist/index.html as ONE self-contained file (three.js + meshoptimizer inlined),
// so it opens from your desktop with no internet connection.
// meshlabCLI: while running `npm run dev` / `npm run preview`, files too big for the browser go to cli/meshlab.mjs.
export default defineConfig({
  plugins: [viteSingleFile(), meshlabCLI()],
  build: { target: 'es2020', chunkSizeWarningLimit: 4000 }
});
