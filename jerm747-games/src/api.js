const BASE = '/api';

async function handle(res) {
  let data = null;
  try { data = await res.json(); } catch { throw new Error("The server didn't answer properly. Try again in a minute."); }
  if (!res.ok || !data.ok) throw new Error(data?.error || 'Something went wrong. Try again.');
  return data;
}

export async function adminStatus() {
  return handle(await fetch(`${BASE}/admin.php?action=status`));
}

export async function adminSetup(password) {
  return handle(await fetch(`${BASE}/admin.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup', password }),
  }));
}

export async function adminGet(password, params) {
  const qs = new URLSearchParams(params).toString();
  return handle(await fetch(`${BASE}/admin.php?${qs}`, { headers: { 'X-Admin-Password': password } }));
}

export async function adminPost(password, action, fields = {}) {
  const fd = new FormData();
  fd.append('action', action);
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  return handle(await fetch(`${BASE}/admin.php`, { method: 'POST', headers: { 'X-Admin-Password': password }, body: fd }));
}
