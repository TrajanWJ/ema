const DEFAULT_DAEMON_BASE = "http://127.0.0.1:4488";
const TOKEN_STORAGE_KEY = "ema_api_access_token";

const envBase =
  typeof import.meta !== "undefined" ? (import.meta as { env?: Record<string, string> }).env?.VITE_EMA_DAEMON_URL : null;

const envToken =
  typeof import.meta !== "undefined"
    ? (import.meta as { env?: Record<string, string> }).env?.VITE_EMA_API_TOKEN ||
      (import.meta as { env?: Record<string, string> }).env?.VITE_EMA_API_ACCESS_TOKEN
    : null;

const normalizeBaseUrl = (value: string | null | undefined): string => {
  const raw = (value || "").trim();
  if (!raw) return DEFAULT_DAEMON_BASE;
  const withoutTrailingSlash = raw.replace(/\/+$/, "");
  const withoutApiPath = withoutTrailingSlash.replace(/\/api$/i, "");
  return withoutApiPath || DEFAULT_DAEMON_BASE;
};

const persistTokenAndScrubQuery = (token: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);

  const next = new URL(window.location.href);
  next.searchParams.delete("api_token");
  next.searchParams.delete("token");
  if (next.href !== window.location.href) {
    window.history.replaceState({}, "", next.href);
  }
};

const parseWebsocketUrl = (base: string): string => {
  try {
    const parsed = new URL(base);
    const proto = parsed.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${parsed.host}`;
  } catch {
    return base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
  }
};

export const DAEMON_BASE_URL = normalizeBaseUrl(envBase || DEFAULT_DAEMON_BASE);
export const DAEMON_API_BASE = `${DAEMON_BASE_URL}/api`;
export const DAEMON_HEALTH_URL = `${DAEMON_API_BASE}/health`;
export const DAEMON_WS_URL = `${parseWebsocketUrl(DAEMON_BASE_URL)}/socket`;

let memoizedToken: string | null | undefined;

const queryToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("api_token") || params.get("token");
};

const resolveToken = (): string | null => {
  if (typeof window === "undefined") return null;

  const fromQuery = queryToken();
  if (fromQuery) {
    const token = fromQuery.trim();
    persistTokenAndScrubQuery(token);
    return fromQuery.trim();
  }

  if (envToken && envToken.trim()) return envToken.trim();

  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const getDaemonAuthToken = (): string | null => {
  if (memoizedToken === undefined) {
    memoizedToken = resolveToken();
  }
  return memoizedToken || null;
};
