import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// UI-only preview without PHP: JERM_UI_PREVIEW=1 npm run dev.
// The normal development proxy and production PHP APIs are unchanged.
function uiPreview() {
  return {
    name: 'jerm-ui-preview',
    configureServer(server) {
      if (process.env.JERM_UI_PREVIEW !== '1') return;
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (pathname !== '/api/games.php' && pathname !== '/api/track.php') return next();
        res.setHeader('Content-Type', 'application/json');
        if (pathname === '/api/track.php') return res.end(JSON.stringify({ ok: true, preview: true }));
        const root = resolve('public/projects');
        const projects = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(resolve(root, d.name, 'index.html'))).flatMap(d => {
          const path = resolve(root, d.name);
          const m = existsSync(resolve(path, 'project.json')) ? JSON.parse(readFileSync(resolve(path, 'project.json'), 'utf8')) : {};
          if (m.hidden) return [];
          const cover = ['cover.webp', 'cover.png', 'cover.jpg', 'cover.jpeg', 'cover.gif'].find(c => existsSync(resolve(path, c)));
          return [{ title: d.name, kind: 'experiment', status: 'in_progress', controls: [], description: '', tagline: '', order: 100, ...m, slug: d.name, url: `/projects/${d.name}/index.html`, cover: cover ? `/projects/${d.name}/${cover}` : '', screenshots: (m.screenshots || []).map(x => ({ src: `/projects/${d.name}/${x.src}`, thumb: `/projects/${d.name}/${x.thumb || x.src}`, caption: x.caption || '' })) }];
        }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
        res.end(JSON.stringify({ ok: true, preview: true, projects }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), uiPreview()],
  server: { allowedHosts: ['terminal.local'], proxy: { '/api': 'http://localhost:8000' } },
});
