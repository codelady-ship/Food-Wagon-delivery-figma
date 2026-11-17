// API client. Talks to the Express API at VITE_API_URL; if it is not set, unreachable or slower
// than 8 s, every call is answered by the bundled demo API (seed data + localStorage) instead,
// so the static site on GitHub Pages never breaks.
import { demoRequest } from "./demo-api.js";
import { ApiError } from "./errors.js";
import { getAuth, clearAuth } from "./store.js";

export { ApiError };

const BASE = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
const TIMEOUT_MS = 8000;
const MODE_KEY = "fw-api-mode";
const MODE_TTL = 5 * 60 * 1000;

let modePromise;

function timed(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function remember(mode) {
  try {
    sessionStorage.setItem(MODE_KEY, JSON.stringify({ mode, at: Date.now(), base: BASE }));
  } catch {
    /* storage blocked: detect again next page */
  }
  document.documentElement.dataset.api = mode;
  window.dispatchEvent(new CustomEvent("api:mode", { detail: mode }));
  return mode;
}

async function detect() {
  if (!BASE) return remember("demo");
  try {
    const cached = JSON.parse(sessionStorage.getItem(MODE_KEY) || "null");
    if (cached && cached.base === BASE && Date.now() - cached.at < MODE_TTL) return remember(cached.mode);
  } catch {
    /* ignore */
  }
  try {
    const res = await timed(`${BASE}/api/health`);
    const body = await res.json();
    return remember(res.ok && body.db === "up" ? "live" : "demo");
  } catch {
    return remember("demo");
  }
}

/** "live" (real API) or "demo" (bundled data). */
export function apiMode() {
  if (!modePromise) modePromise = detect();
  return modePromise;
}

function switchToDemo() {
  modePromise = Promise.resolve(remember("demo"));
}

/**
 * api("/restaurants?cuisine=asian")
 * api("/orders", { method: "POST", body: {...} })
 * api("/admin/uploads", { method: "POST", form: formData })
 */
export async function api(path, { method = "GET", body, form } = {}) {
  const mode = await apiMode();
  const auth = getAuth();
  const token = auth && auth.mode === mode ? auth.token : null;

  if (mode === "live") {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await timed(`${BASE}/api${path}`, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) });
    } catch {
      switchToDemo(); // network error or timeout: keep the site usable with demo data
      return demoRequest(method, path, body ?? form, null);
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && token) clearAuth();
      throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.details);
    }
    return data;
  }
  return demoRequest(method, path, body ?? form, token);
}
