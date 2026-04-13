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
 * - Surfaces without a live backend are marked `@deferred` and throw a
 *   directive SDK error naming the missing service seam.
 */

import type {
  Execution,
  Intent,
  Space,
  UserStateSnapshot,
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
  create(input: Partial<Intent>): Promise<Intent>;
  /** @deferred Missing generic PATCH route in `services/core/intents`. */
  update(id: string, patch: Partial<Intent>): Promise<Intent>;
}

interface ProposalsApi {
  listSeeds(): Promise<unknown[]>;
  listHarvested(): Promise<unknown[]>;
  create(input: unknown): Promise<unknown>;
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
  /** @deferred Missing `services/core/vault` HTTP surface. */
  search(query: string): Promise<unknown>;
  /** @deferred Missing `services/core/vault` HTTP surface. */
  read(path: string): Promise<string>;
  /** @deferred Missing `services/core/vault` HTTP surface. */
  write(path: string, contents: string): Promise<void>;
}

interface CanonApi {
  /** @deferred Missing `services/core/canon` HTTP surface. */
  read(path: string): Promise<string>;
  /** @deferred Missing `services/core/canon` HTTP surface. */
  write(path: string, contents: string): Promise<void>;
}

interface AgentsApi {
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
  list(): Promise<Space[]>;
  get(id: string): Promise<Space>;
  create(input: Omit<Space, "id" | "inserted_at" | "updated_at"> & {
    actor: string;
    activate?: boolean;
  }): Promise<Space>;
}

interface UserStateApi {
  latest(actorId?: string): Promise<UserStateSnapshot>;
  report(input: {
    mode?: UserStateSnapshot["mode"];
    focus_score?: number;
    energy_score?: number;
    distress_flag?: boolean;
    drift_score?: number;
    current_intent_slug?: string | null;
    updated_by?: UserStateSnapshot["updated_by"];
    reason?: string;
  }): Promise<UserStateSnapshot>;
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

  function unwrap<T>(payload: Record<string, unknown>, key: string): T {
    return payload[key] as T;
  }

  async function deferred<T>(reason: string): Promise<T> {
    throw new Error(`ema_sdk_deferred ${reason}`);
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
      list: async () => unwrap<Intent[]>(
        await request<Record<string, unknown>>("/api/intents"),
        "intents",
      ),
      get: async (id) => unwrap<Intent>(
        await request<Record<string, unknown>>(
          `/api/intents/${encodeURIComponent(id)}`,
        ),
        "intent",
      ),
      create: async (input) => unwrap<Intent>(
        await post<Record<string, unknown>>("/api/intents", input),
        "intent",
      ),
      update: (_id, _patch) =>
        deferred<Intent>(
          "Missing generic PATCH route in services/core/intents; use create + status/phase routes for now.",
        ),
    },
    proposals: {
      listSeeds: async () => unwrap<unknown[]>(
        await request<Record<string, unknown>>("/api/proposals/seeds"),
        "seeds",
      ),
      listHarvested: async () => unwrap<unknown[]>(
        await request<Record<string, unknown>>("/api/proposals/harvested"),
        "intents",
      ),
      create: async (input) => unwrap<unknown>(
        await post<Record<string, unknown>>("/api/proposals", input),
        "proposal",
      ),
      approve: async (id) => unwrap<unknown>(
        await post<Record<string, unknown>>(
          `/api/proposals/${encodeURIComponent(id)}/approve`,
          {},
        ),
        "proposal",
      ),
    },
    executions: {
      list: async () => unwrap<Execution[]>(
        await request<Record<string, unknown>>("/api/executions"),
        "executions",
      ),
      get: async (id) => unwrap<Execution>(
        await request<Record<string, unknown>>(
          `/api/executions/${encodeURIComponent(id)}`,
        ),
        "execution",
      ),
      create: async (input) => unwrap<Execution>(
        await post<Record<string, unknown>>("/api/executions", input),
        "execution",
      ),
    },
    brainDump: {
      list: async () => unwrap<unknown[]>(
        await request<Record<string, unknown>>("/api/brain-dump/items"),
        "items",
      ),
      create: async (text) => unwrap<unknown>(
        await post<Record<string, unknown>>("/api/brain-dump/items", { content: text }),
        "item",
      ),
    },
    vault: {
      search: (query) =>
        deferred(`Missing services/core/vault search route for query=${query}`),
      read: (path) =>
        deferred(`Missing services/core/vault read route for path=${path}`),
      write: (path, _contents) =>
        deferred(`Missing services/core/vault write route for path=${path}`),
    },
    canon: {
      read: (path) =>
        deferred(`Missing services/core/canon read route for path=${path}`),
      write: (path, _contents) =>
        deferred(`Missing services/core/canon write route for path=${path}`),
    },
    agents: {
      status: () => request("/api/agents/status"),
      emitRuntimeTransition: (input) =>
        post<void>("/api/agents/runtime-transition", input),
    },
    spaces: {
      list: async () => unwrap<Space[]>(
        await request<Record<string, unknown>>("/api/spaces"),
        "spaces",
      ),
      get: async (id) => unwrap<Space>(
        await request<Record<string, unknown>>(
          `/api/spaces/${encodeURIComponent(id)}`,
        ),
        "space",
      ),
      create: async (input) => unwrap<Space>(
        await post<Record<string, unknown>>("/api/spaces", input),
        "space",
      ),
    },
    userState: {
      latest: async (_actorId) => unwrap<UserStateSnapshot>(
        await request<Record<string, unknown>>("/api/user-state/current"),
        "state",
      ),
      report: async (input) => unwrap<UserStateSnapshot>(
        await post<Record<string, unknown>>("/api/user-state/update", input),
        "state",
      ),
    },
    events: eventBus,
  };
}
