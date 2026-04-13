/**
 * `@ema/core` SDK facade — GAC-006 resolution.
 *
 * vApps and agents import this module instead of reaching into stores or
 * hand-rolling `fetch` calls against `http://localhost:4488`. The facade is a
 * thin, typed wrapper over the existing HTTP/WebSocket transport — every
 * method maps 1:1 to a route registered under `services/http/server.ts`.
 *
 * Pattern cribbed from Logseq's `@logseq/libs` (flat global) plus Piral's
 * `pilet-api` (registerTile-style shell integration). Joplin's domain
 * namespacing informs the sub-object grouping.
 *
 * Stability:
 * - The method names are the public contract — rename through a proposal only.
 * - Route paths are an implementation detail — the facade absorbs path drift.
 * - Endpoints that do not yet exist are marked `@pending`. They still have a
 *   typed signature so vApps can import them today; calling an unimplemented
 *   endpoint returns the raw HTTP error from the daemon.
 */

import type {
  Execution,
  Intent,
  Space,
  UserState,
} from "../schemas/index.js";

export interface EmaClientOptions {
  baseUrl?: string;
  token?: string;
  /** Injectable for tests. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export interface EmaClient {
  intents: IntentsApi;
  proposals: ProposalsApi;
  executions: ExecutionsApi;
  brainDump: BrainDumpApi;
  vault: VaultApi;
  canon: CanonApi;
  agents: AgentsApi;
  spaces: SpacesApi;
  userState: UserStateApi;
  /** Cross-vApp pub/sub over the daemon's Phoenix-protocol WS bus. */
  events: EventsApi;
  /** Raw escape hatch for unwrapped endpoints. */
  request<T = unknown>(path: string, init?: RequestInit): Promise<T>;
}

interface IntentsApi {
  list(): Promise<Intent[]>;
  get(id: string): Promise<Intent>;
  /** @pending `/api/intents` POST does not yet exist in services/core/intents. */
  create(input: Partial<Intent>): Promise<Intent>;
  /** @pending Depends on intent-engine route recovery. */
  update(id: string, patch: Partial<Intent>): Promise<Intent>;
}

interface ProposalsApi {
  listSeeds(): Promise<unknown[]>;
  listHarvested(): Promise<unknown[]>;
  /** @pending POST /api/proposals route not yet registered. */
  create(input: unknown): Promise<unknown>;
  /** @pending */
  approve(id: string): Promise<unknown>;
}

interface ExecutionsApi {
  list(): Promise<Execution[]>;
  get(id: string): Promise<Execution>;
  create(input: {
    title: string;
    objective?: string | null;
    mode?: string;
    requires_approval?: boolean;
  }): Promise<Execution>;
}

interface BrainDumpApi {
  list(): Promise<unknown[]>;
  create(text: string): Promise<unknown>;
}

interface VaultApi {
  /** @pending `/api/vault/search` route not yet registered. */
  search(query: string): Promise<unknown>;
  /** @pending */
  read(path: string): Promise<string>;
  /** @pending */
  write(path: string, contents: string): Promise<void>;
}

interface CanonApi {
  /** @pending Reads from `ema-genesis/`. Route not yet registered. */
  read(path: string): Promise<string>;
  /** @pending Active canon writes require GAC approval. */
  write(path: string, contents: string): Promise<void>;
}

interface AgentsApi {
  /** @pending GET /api/agents/status. */
  status(): Promise<unknown>;
  /** Runtime-state transition emit hook used by the heartbeat poller. */
  emitRuntimeTransition(input: {
    actor_id: string;
    from_state: string | null;
    to_state: string;
    reason: string;
    observed_at: string;
  }): Promise<void>;
}

interface SpacesApi {
  /** @pending GAC-007 schema just landed; routes follow. */
  list(): Promise<Space[]>;
  /** @pending */
  get(id: string): Promise<Space>;
  /** @pending */
  create(input: Omit<Space, "id" | "inserted_at" | "updated_at">): Promise<Space>;
}

interface UserStateApi {
  /** @pending GAC-010 observer pipeline not yet built. */
  latest(actorId: string): Promise<UserState | null>;
  /** @pending */
  report(input: Omit<UserState, "id" | "inserted_at" | "updated_at">): Promise<UserState>;
}

interface EventsApi {
  on(topic: string, handler: (event: string, payload: unknown) => void): () => void;
  emit(topic: string, event: string, payload: unknown): void;
}

const DEFAULT_BASE_URL = "http://localhost:4488";

/**
 * Build an `@ema/core` client. Call once at vApp boot and pass the returned
 * object around. The client is stateless besides its `baseUrl` and `token`.
 */
export function createEmaClient(opts: EmaClientOptions = {}): EmaClient {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const doFetch = opts.fetch ?? fetch;
  const token = opts.token;

  async function request<T = unknown>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);

    const res = await doFetch(`${baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ema_request_failed ${res.status} ${path}: ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async function post<T = unknown>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  // Lazy-imported so the shared package stays framework-free. Only vApps
  // running inside a browser use the events API; workers stay on raw fetch.
  const eventBus: EventsApi = {
    on(_topic, _handler) {
      return () => {};
    },
    emit(_topic, _event, _payload) {
      // no-op until realtime client adapter is wired; see services/realtime/.
    },
  };

  return {
    request,
    intents: {
      list: () => request<Intent[]>("/api/intents"),
      get: (id) => request<Intent>(`/api/intents/${encodeURIComponent(id)}`),
      create: (input) => post<Intent>("/api/intents", input),
      update: (id, patch) =>
        request<Intent>(`/api/intents/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
    },
    proposals: {
      listSeeds: () => request<unknown[]>("/api/proposals/seeds"),
      listHarvested: () => request<unknown[]>("/api/proposals/harvested"),
      create: (input) => post("/api/proposals", input),
      approve: (id) => post(`/api/proposals/${encodeURIComponent(id)}/approve`, {}),
    },
    executions: {
      list: () => request<Execution[]>("/api/executions"),
      get: (id) => request<Execution>(`/api/executions/${encodeURIComponent(id)}`),
      create: (input) => post<Execution>("/api/executions", input),
    },
    brainDump: {
      list: () => request<unknown[]>("/api/brain-dump/items"),
      create: (text) => post("/api/brain-dump/items", { text }),
    },
    vault: {
      search: (query) => request(`/api/vault/search?q=${encodeURIComponent(query)}`),
      read: (path) =>
        request<string>(`/api/vault/read?path=${encodeURIComponent(path)}`),
      write: (path, contents) => post("/api/vault/write", { path, contents }),
    },
    canon: {
      read: (path) =>
        request<string>(`/api/canon/read?path=${encodeURIComponent(path)}`),
      write: (path, contents) => post("/api/canon/write", { path, contents }),
    },
    agents: {
      status: () => request("/api/agents/status"),
      emitRuntimeTransition: (input) =>
        post<void>("/api/agents/runtime-transition", input),
    },
    spaces: {
      list: () => request<Space[]>("/api/spaces"),
      get: (id) => request<Space>(`/api/spaces/${encodeURIComponent(id)}`),
      create: (input) => post<Space>("/api/spaces", input),
    },
    userState: {
      latest: (actorId) =>
        request<UserState | null>(
          `/api/user-state/latest?actor_id=${encodeURIComponent(actorId)}`,
        ),
      report: (input) => post<UserState>("/api/user-state", input),
    },
    events: eventBus,
  };
}
