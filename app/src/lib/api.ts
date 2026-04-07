const BASE = "http://localhost:4488/api";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Resolve fetch: Tauri HTTP plugin in desktop, native fetch in browser.
// Dynamic import avoids crash when @tauri-apps/plugin-http isn't available.
let resolvedFetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);

if (isTauri) {
  import("@tauri-apps/plugin-http")
    .then((mod) => { resolvedFetch = mod.fetch as typeof globalThis.fetch; })
    .catch(() => { /* browser fallback */ });
}

export const doFetch: typeof globalThis.fetch = (...args) => resolvedFetch(...args);

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await doFetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
