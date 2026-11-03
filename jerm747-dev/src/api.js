const BASE = '/api';

async function handle(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error("The server didn't answer properly. Try again in a minute.");
  }
  if (!res.ok || !data.ok) throw new Error(data?.error || 'Something went wrong. Try again.');
  return data;
}

export async function submitRequest(payload) {
  const res = await fetch(`${BASE}/request.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function getProject(key) {
  const res = await fetch(`${BASE}/project.php?key=${encodeURIComponent(key)}`);
  return handle(res);
}

export async function sendClientMessage(key, body, files) {
  const fd = new FormData();
  fd.append('key', key);
  fd.append('body', body);
  for (const f of files) fd.append('files[]', f);
  const res = await fetch(`${BASE}/project.php`, { method: 'POST', body: fd });
  return handle(res);
}

export function fileUrl(key, id) {
  return `${BASE}/file.php?key=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`;
}

// Sites in development. Jeremy's admin password (from the admin page session) rides along
// when present so he can manage sites from the same pages clients see.
export function adminPassword() {
  try { return sessionStorage.getItem('j747-admin') || ''; } catch { return ''; }
}

function siteHeaders() {
  const pw = adminPassword();
  return pw ? { 'X-Admin-Password': pw } : {};
}

export async function listSites() {
  return handle(await fetch(`${BASE}/sites.php?action=list`, { headers: siteHeaders() }));
}

export async function getSite(slug, token = '') {
  const qs = new URLSearchParams({ action: 'get', slug, token }).toString();
  return handle(await fetch(`${BASE}/sites.php?${qs}`, { headers: siteHeaders() }));
}

export async function getRevision(slug, token, v) {
  const qs = new URLSearchParams({ action: 'revision', slug, token, v }).toString();
  return handle(await fetch(`${BASE}/sites.php?${qs}`, { headers: siteHeaders() }));
}

// Returns the server's answer even on a save conflict, so the page can show the newer version.
export async function siteAction(action, fields = {}, files = []) {
  const fd = new FormData();
  fd.append('action', action);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v === true ? '1' : v === false ? '0' : String(v ?? ''));
  for (const f of files) fd.append('files[]', f);
  const res = await fetch(`${BASE}/sites.php`, { method: 'POST', headers: siteHeaders(), body: fd });
  let data = null;
  try { data = await res.json(); } catch { throw new Error("The server didn't answer properly. Try again in a minute."); }
  if (data?.conflict) {
    const err = new Error(data.error);
    err.conflict = true;
    err.site = data.site;
    throw err;
  }
  if (!res.ok || !data.ok) throw new Error(data?.error || 'Something went wrong. Try again.');
  return data;
}

export function siteFileUrl(slug, token, id, inline = false) {
  const qs = new URLSearchParams({ slug, id, token, ...(inline ? { inline: '1' } : {}) }).toString();
  return `${BASE}/sitefile.php?${qs}`;
}

// Admin
export async function adminStatus() {
  return handle(await fetch(`${BASE}/admin.php?action=status`));
}

export async function adminSetup(password) {
  return handle(
    await fetch(`${BASE}/admin.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setup', password }),
    }),
  );
}

export async function adminGet(password, params) {
  const qs = new URLSearchParams(params).toString();
  return handle(await fetch(`${BASE}/admin.php?${qs}`, { headers: { 'X-Admin-Password': password } }));
}

export async function adminPost(password, action, fields = {}, files = []) {
  const fd = new FormData();
  fd.append('action', action);
  for (const [k, v] of Object.entries(fields)) fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  for (const f of files) fd.append('files[]', f);
  return handle(
    await fetch(`${BASE}/admin.php`, { method: 'POST', headers: { 'X-Admin-Password': password }, body: fd }),
  );
}
