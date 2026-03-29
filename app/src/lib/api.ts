import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const BASE = "http://localhost:4488/api";

// Use Tauri's HTTP plugin which bypasses CORS and respects capability permissions.
// In Tauri 2, the global is __TAURI_INTERNALS__ (not __TAURI__).
const doFetch =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? tauriFetch
    : globalThis.fetch;

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
