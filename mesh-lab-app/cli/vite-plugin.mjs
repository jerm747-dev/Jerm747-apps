// Lets the Mesh Lab page hand files that are too big for the browser to the CLI (cli/meshlab.mjs).
// Active only while the page is served by `npm run dev` or `npm run preview`; the single-file build is unchanged.
//
//   GET  /api/meshlab/ping                               → { ok: true }
//   PUT  /api/meshlab/file?job=ID&name=FILE    (body)     → saves one input file (zip / fbx / glb / png) for a job
//   POST /api/meshlab/run?job=ID&input=FILE&target=N[&tex=N][&yup=1]
//                                                        → runs the CLI, answers with the GLB (X-Meshlab-From / -Tris, -Log)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'meshlab.mjs');
const JOB = /^[a-z0-9]{8,40}$/i, NAME = /^[\w .()+-]+\.(zip|fbx|glb|png|jpe?g)$/i;
const jobDir = id => path.join(os.tmpdir(), 'meshlab-' + id);

// uploads whose run never came (page closed mid-way) are cleared after 6 hours
function sweep() {
  for (const d of fs.readdirSync(os.tmpdir())) {
    if (!d.startsWith('meshlab-')) continue;
    const p = path.join(os.tmpdir(), d);
    try { if (Date.now() - fs.statSync(p).mtimeMs > 6 * 3600e3) fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* in use or gone */ }
  }
}

function handler(req, res, next) {
  const url = new URL(req.url, 'http://x'), q = url.searchParams, job = q.get('job') || '';
  const fail = (code, text) => { res.statusCode = code; res.setHeader('Content-Type', 'text/plain'); res.end(text); };
  if (req.method === 'GET' && url.pathname === '/ping') { res.setHeader('Content-Type', 'application/json'); return res.end('{"ok":true}'); }
  if (req.method === 'PUT' && url.pathname === '/file') {
    const name = q.get('name') || '';
    if (!JOB.test(job) || !NAME.test(name) || path.basename(name) !== name) return fail(400, 'bad job or file name');
    sweep();
    fs.mkdirSync(jobDir(job), { recursive: true });
    const out = fs.createWriteStream(path.join(jobDir(job), name));
    req.pipe(out);
    out.on('finish', () => { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); });
    out.on('error', e => fail(500, e.message));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/run') {
    const input = q.get('input') || '', target = parseInt(q.get('target'), 10), tex = parseInt(q.get('tex') || '1024', 10);
    if (!JOB.test(job) || !NAME.test(input) || !(target > 0) || !(tex > 0)) return fail(400, 'bad run request');
    const dir = jobDir(job), inFile = path.join(dir, input), outFile = path.join(dir, 'out.glb');
    if (!fs.existsSync(inFile)) return fail(404, 'upload the input first');
    const args = [CLI, inFile, '--target', String(target), '--tex', String(tex), '--out', outFile];
    if (q.get('yup') === '1') args.push('--yup');
    const child = spawn(process.execPath, args, { cwd: dir });
    let log = '';
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    req.on('close', () => { if (!res.writableEnded) child.kill(); });   // page went away
    child.on('close', code => {
      const done = () => fs.rmSync(dir, { recursive: true, force: true });
      if (code !== 0 || !fs.existsSync(outFile)) { done(); return fail(500, log.trim() || `CLI exited with code ${code}`); }
      const glb = fs.readFileSync(outFile), m = log.match(/([\d,]+) → ([\d,]+) triangles/) || [];
      done();
      res.setHeader('Content-Type', 'model/gltf-binary');
      res.setHeader('X-Meshlab-From', (m[1] || '').replace(/,/g, ''));
      res.setHeader('X-Meshlab-Tris', (m[2] || '').replace(/,/g, ''));
      res.setHeader('X-Meshlab-Log', encodeURIComponent(log.trim().split('\n').slice(-6).join('\n')));
      res.end(glb);
    });
    return;
  }
  next();
}

export default function meshlabCLI() {
  return {
    name: 'meshlab-cli',
    configureServer(server) { server.middlewares.use('/api/meshlab', handler); },
    configurePreviewServer(server) { server.middlewares.use('/api/meshlab', handler); },
  };
}
