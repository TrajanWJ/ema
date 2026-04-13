import { DAEMON_API_BASE, getDaemonAuthToken } from "@/lib/daemon-config";

const toHeaders = (input?: HeadersInit): Headers => {
  const headers = new Headers(input);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getDaemonAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const resolveUrl = (path: string): string =>
  path.startsWith("http") ? path : `${DAEMON_API_BASE}${path}`;

/** Direct fetch — no Tauri HTTP plugin needed with csp: null */
export async function ensureReady(): Promise<void> {}

export async function doFetch(input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const init = {
    ...options,
    headers: toHeaders(options.headers),
  };
  return globalThis.fetch(resolveUrl(typeof input === "string" ? input : input.toString()), init);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const merged = options
    ? {
        ...options,
        headers: toHeaders(options.headers),
      }
    : { headers: toHeaders() };

  const res = await doFetch(path, merged);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: toHeaders({ "Content-Type": "application/json" }),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: toHeaders({ "Content-Type": "application/json" }),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: toHeaders({ "Content-Type": "application/json" }),
    }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE", headers: toHeaders() }),
};
