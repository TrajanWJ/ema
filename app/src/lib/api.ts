const BASE = "http://127.0.0.1:4488/api";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let resolvedFetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);
let pluginReady = false;

// Load Tauri HTTP plugin eagerly
const pluginPromise: Promise<void> = isTauri
  ? import("@tauri-apps/plugin-http")
      .then((mod) => {
        resolvedFetch = mod.fetch as typeof globalThis.fetch;
        pluginReady = true;
      })
      .catch(() => { pluginReady = true; /* browser fallback */ })
  : Promise.resolve().then(() => { pluginReady = true; });

/** Wait for the HTTP plugin to be ready before first request */
export async function ensureReady(): Promise<void> {
  await pluginPromise;
}

export const doFetch: typeof globalThis.fetch = async (...args) => {
  if (!pluginReady) await pluginPromise;
  return resolvedFetch(...args);
};

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
