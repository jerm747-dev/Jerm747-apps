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
