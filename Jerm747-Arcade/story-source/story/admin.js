/**
 * Sign-in for /admin/chart. The password is checked by the server (api/admin-login.php), which
 * hands back a signed token that expires (12 hours, or 30 days with "Keep me signed in").
 * The token is kept in this browser only: for the tab (sessionStorage) or, with "Keep me signed
 * in", on this device (localStorage). "Lock" forgets it.
 */
import { site } from "./data/site.js";

const API = (site.api || "").replace(/\/+$/, "");
const KEY = "jerm747.admin";

const stores = () => { const s = []; try { s.push(sessionStorage, localStorage); } catch { /* blocked */ } return s; };

export function getToken() {
  for (const s of stores()) {
    try {
      const v = JSON.parse(s.getItem(KEY) || "null");
      if (v && v.token && v.expires * 1000 > Date.now()) return v.token;
    } catch { /* ignore */ }
  }
  return "";
}

export function signOut() { for (const s of stores()) { try { s.removeItem(KEY); } catch { /* ignore */ } } }

/** → resolves on success; rejects with a message to show */
export async function signIn(password, remember) {
  if (!API) throw new Error("The stats server is turned off (site.api is empty).");
  let res;
  try {
    res = await fetch(`${API}/admin-login.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ password, remember }),
    });
  } catch {
    throw new Error("Couldn't reach the server.");
  }
  const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : null;
  if (!res.ok || !data?.token) throw new Error(data?.error || `The server didn't answer (${res.status}).`);
  signOut();
  const store = remember ? localStorage : sessionStorage;
  try { store.setItem(KEY, JSON.stringify({ token: data.token, expires: data.expires })); } catch { /* private mode */ }
  return data.token;
}
