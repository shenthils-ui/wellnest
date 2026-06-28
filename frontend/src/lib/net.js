// Low-level fetch helpers. API is always same-origin: in production Express
// serves the app, and in dev Vite proxies /api to the backend.

const DEFAULT_TIMEOUT = 8000;

export class NetworkError extends Error {}
export class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, body, { timeout = DEFAULT_TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new NetworkError(e.message || 'network error');
  }
  clearTimeout(timer);

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) throw new HttpError(res.status, data);
  return data;
}

export const apiGet = (path, opts) => request('GET', path, undefined, opts);
export const apiPost = (path, body, opts) => request('POST', path, body, opts);
export const apiPut = (path, body, opts) => request('PUT', path, body, opts);
export const apiDelete = (path, body, opts) => request('DELETE', path, body, opts);

// Quick reachability check against the home server.
export async function ping() {
  try {
    await request('GET', '/api/health', undefined, { timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}
