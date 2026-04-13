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
  ChronicleExtractionRun,
  ChronicleSessionDetail,
  ChronicleSessionSummary,
  CreateChronicleImportInput,
  CreateProposalInput,
  Execution,
  FeedAction,
  FeedActionType,
  FeedConversation,
  FeedItem,
  FeedView,
  FeedWorkspace,
  Intent,
  ListReviewItemsFilter,
  ProposalRecord,
  PromoteReviewItemInput,
  RejectProposalInput,
  ReviewDecisionInput,
  ReviewItem,
  ReviewItemDetail,
  ReviewItemSummary,
  RuntimeSession,
  RuntimeSessionScreen,
  RuntimeTool,
  ReviseCoreProposalInput,
  Space,
  StartProposalExecutionInput,
  UserStateSnapshot,
} from "../schemas/index.js";

export interface EmaClientOptions {
  baseUrl?: string;
  token?: string;
  /** Injectable for tests. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export interface EmaClient {
  chronicle: ChronicleApi;
  review: ReviewApi;
  intents: IntentsApi;
  proposals: ProposalsApi;
  executions: ExecutionsApi;
  brainDump: BrainDumpApi;
  vault: VaultApi;
  canon: CanonApi;
  agents: AgentsApi;
  spaces: SpacesApi;
  feeds: FeedsApi;
  runtimeFabric: RuntimeFabricApi;
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

interface ChronicleApi {
  listSessions(filter?: {
    source_kind?: string;
    source_id?: string;
    limit?: number;
  }): Promise<ChronicleSessionSummary[]>;
  getSession(id: string): Promise<ChronicleSessionDetail>;
  importBundle(input: CreateChronicleImportInput): Promise<ChronicleSessionDetail>;
  importFile(input: {
    path: string;
    agent?: string;
    source_kind?: string;
    source_label?: string;
  }): Promise<ChronicleSessionDetail>;
  extractSession(id: string): Promise<ChronicleExtractionRun>;
}

interface ReviewApi {
  listItems(filter?: ListReviewItemsFilter): Promise<ReviewItemSummary[]>;
  getItem(id: string): Promise<ReviewItemDetail>;
  approve(id: string, input: ReviewDecisionInput): Promise<ReviewItem>;
  reject(id: string, input: ReviewDecisionInput): Promise<ReviewItem>;
  defer(id: string, input: ReviewDecisionInput): Promise<ReviewItem>;
  promote(id: string, input: PromoteReviewItemInput): Promise<ReviewItemDetail>;
}

interface ProposalsApi {
  list(filter?: { status?: ProposalRecord["status"]; intent_id?: string }): Promise<ProposalRecord[]>;
  get(id: string): Promise<ProposalRecord>;
  create(input: CreateProposalInput): Promise<ProposalRecord>;
  approve(id: string, input?: { actor_id?: string }): Promise<ProposalRecord>;
  reject(id: string, input: RejectProposalInput): Promise<ProposalRecord>;
  revise(id: string, input: ReviseCoreProposalInput): Promise<ProposalRecord>;
  startExecution(id: string, input?: StartProposalExecutionInput): Promise<Execution>;
  listSeeds(): Promise<unknown[]>;
  listHarvested(): Promise<unknown[]>;
}

interface ExecutionsApi {
  list(): Promise<Execution[]>;
  get(id: string): Promise<Execution>;
  /** Compatibility shortcut. Prefer `proposals.startExecution()` for the active loop. */
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

interface FeedsApi {
  workspace(input?: {
    surface?: FeedWorkspace["surface"];
    scope_id?: string;
    view_id?: string;
    query?: string;
    include_hidden?: boolean;
  }): Promise<FeedWorkspace>;
  updateViewPrompt(viewId: string, prompt: string): Promise<FeedView>;
  actOnItem(
    itemId: string,
    input: {
      action: FeedActionType;
      actor: string;
      note?: string | null;
      target_scope_id?: string | null;
    },
  ): Promise<{
    item: FeedItem;
    action: FeedAction;
    conversation?: FeedConversation;
  }>;
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

interface RuntimeFabricApi {
  listTools(): Promise<RuntimeTool[]>;
  scanTools(): Promise<RuntimeTool[]>;
  listSessions(): Promise<RuntimeSession[]>;
  getSession(id: string): Promise<RuntimeSession>;
  getScreen(id: string, lines?: number): Promise<RuntimeSessionScreen>;
  createSession(input: {
    tool_kind: string;
    cwd?: string;
    session_name?: string;
    startup_options?: string[];
    command?: string;
    initial_input?: string;
    simulate_typing?: boolean;
  }): Promise<RuntimeSession>;
  dispatch(input: {
    tool_kind: string;
    prompt: string;
    session_id?: string;
    cwd?: string;
    session_name?: string;
    startup_options?: string[];
    command?: string;
    simulate_typing?: boolean;
  }): Promise<{ session: RuntimeSession; screen: RuntimeSessionScreen }>;
  sendInput(id: string, input: {
    mode?: "paste" | "type" | "key";
    text?: string;
    key?: string;
    submit?: boolean;
  }): Promise<RuntimeSession>;
  stopSession(id: string): Promise<RuntimeSession>;
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
    chronicle: {
      listSessions: async (filter = {}) => {
        const query = new URLSearchParams();
        if (filter.source_kind) query.set("source_kind", filter.source_kind);
        if (filter.source_id) query.set("source_id", filter.source_id);
        if (typeof filter.limit === "number") {
          query.set("limit", String(filter.limit));
        }
        const suffix = query.size > 0 ? `?${query.toString()}` : "";
        return unwrap<ChronicleSessionSummary[]>(
          await request<Record<string, unknown>>(`/api/chronicle/sessions${suffix}`),
          "sessions",
        );
      },
      getSession: async (id) => unwrap<ChronicleSessionDetail>(
        await request<Record<string, unknown>>(
          `/api/chronicle/sessions/${encodeURIComponent(id)}`,
        ),
        "detail",
      ),
      importBundle: async (input) => unwrap<ChronicleSessionDetail>(
        await post<Record<string, unknown>>("/api/chronicle/import", input),
        "detail",
      ),
      importFile: async (input) => unwrap<ChronicleSessionDetail>(
        await post<Record<string, unknown>>("/api/chronicle/import-file", input),
        "detail",
      ),
      extractSession: async (id) => unwrap<ChronicleExtractionRun>(
        await post<Record<string, unknown>>(
          `/api/chronicle/sessions/${encodeURIComponent(id)}/extract`,
          {},
        ),
        "run",
      ),
    },
    review: {
      listItems: async (filter = {}) => {
        const query = new URLSearchParams();
        if (filter.status) query.set("status", filter.status);
        if (filter.session_id) {
          query.set("session_id", filter.session_id);
        }
        if (filter.entry_id) {
          query.set("entry_id", filter.entry_id);
        }
        if (filter.candidate_kind) query.set("candidate_kind", filter.candidate_kind);
        if (filter.suggested_target_kind) {
          query.set("suggested_target_kind", filter.suggested_target_kind);
        }
        if (filter.target_kind) query.set("target_kind", filter.target_kind);
        if (typeof filter.limit === "number") {
          query.set("limit", String(filter.limit));
        }
        const suffix = query.size > 0 ? `?${query.toString()}` : "";
        return unwrap<ReviewItemSummary[]>(
          await request<Record<string, unknown>>(`/api/review/items${suffix}`),
          "items",
        );
      },
      getItem: async (id) => unwrap<ReviewItemDetail>(
        await request<Record<string, unknown>>(
          `/api/review/items/${encodeURIComponent(id)}`,
        ),
        "detail",
      ),
      approve: async (id, input) => unwrap<ReviewItem>(
        await post<Record<string, unknown>>(
          `/api/review/items/${encodeURIComponent(id)}/approve`,
          input,
        ),
        "item",
      ),
      reject: async (id, input) => unwrap<ReviewItem>(
        await post<Record<string, unknown>>(
          `/api/review/items/${encodeURIComponent(id)}/reject`,
          input,
        ),
        "item",
      ),
      defer: async (id, input) => unwrap<ReviewItem>(
        await post<Record<string, unknown>>(
          `/api/review/items/${encodeURIComponent(id)}/defer`,
          input,
        ),
        "item",
      ),
      promote: async (id, input) => unwrap<ReviewItemDetail>(
        await post<Record<string, unknown>>(
          `/api/review/items/${encodeURIComponent(id)}/promote`,
          input,
        ),
        "detail",
      ),
    },
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
      list: async (filter = {}) => {
        const query = new URLSearchParams();
        if (filter.status) query.set("status", filter.status);
        if (filter.intent_id) query.set("intent_id", filter.intent_id);
        const suffix = query.size > 0 ? `?${query.toString()}` : "";
        return unwrap<ProposalRecord[]>(
          await request<Record<string, unknown>>(`/api/proposals${suffix}`),
          "proposals",
        );
      },
      get: async (id) => unwrap<ProposalRecord>(
        await request<Record<string, unknown>>(
          `/api/proposals/${encodeURIComponent(id)}`,
        ),
        "proposal",
      ),
      create: async (input) => unwrap<ProposalRecord>(
        await post<Record<string, unknown>>("/api/proposals", input),
        "proposal",
      ),
      approve: async (id, input = {}) => unwrap<ProposalRecord>(
        await post<Record<string, unknown>>(
          `/api/proposals/${encodeURIComponent(id)}/approve`,
          input,
        ),
        "proposal",
      ),
      reject: async (id, input) => unwrap<ProposalRecord>(
        await post<Record<string, unknown>>(
          `/api/proposals/${encodeURIComponent(id)}/reject`,
          input,
        ),
        "proposal",
      ),
      revise: async (id, input) => unwrap<ProposalRecord>(
        await post<Record<string, unknown>>(
          `/api/proposals/${encodeURIComponent(id)}/revise`,
          input,
        ),
        "proposal",
      ),
      startExecution: async (id, input = {}) => unwrap<Execution>(
        await post<Record<string, unknown>>(
          `/api/proposals/${encodeURIComponent(id)}/executions`,
          input,
        ),
        "execution",
      ),
      listSeeds: async () => unwrap<unknown[]>(
        await request<Record<string, unknown>>("/api/proposals/seeds"),
        "seeds",
      ),
      listHarvested: async () => unwrap<unknown[]>(
        await request<Record<string, unknown>>("/api/proposals/harvested"),
        "intents",
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
    feeds: {
      workspace: async (input = {}) => {
        const params = new URLSearchParams();
        if (input.surface) params.set("surface", input.surface);
        if (input.scope_id) params.set("scope_id", input.scope_id);
        if (input.view_id) params.set("view_id", input.view_id);
        if (input.query) params.set("query", input.query);
        if (input.include_hidden !== undefined) {
          params.set("include_hidden", String(input.include_hidden));
        }
        const suffix = params.size > 0 ? `?${params.toString()}` : "";
        return unwrap<FeedWorkspace>(
          await request<Record<string, unknown>>(`/api/feeds${suffix}`),
          "workspace",
        );
      },
      updateViewPrompt: async (viewId, prompt) => unwrap<FeedView>(
        await request<Record<string, unknown>>(
          `/api/feeds/views/${encodeURIComponent(viewId)}/prompt`,
          {
            method: "PUT",
            body: JSON.stringify({ prompt }),
          },
        ),
        "view",
      ),
      actOnItem: async (itemId, input) =>
        await request<{
          item: FeedItem;
          action: FeedAction;
          conversation?: FeedConversation;
        }>(`/api/feeds/items/${encodeURIComponent(itemId)}/actions`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
    },
    runtimeFabric: {
      listTools: async () => unwrap<RuntimeTool[]>(
        await request<Record<string, unknown>>("/api/runtime-fabric/tools"),
        "tools",
      ),
      scanTools: async () => unwrap<RuntimeTool[]>(
        await post<Record<string, unknown>>("/api/runtime-fabric/tools/scan", {}),
        "tools",
      ),
      listSessions: async () => unwrap<RuntimeSession[]>(
        await request<Record<string, unknown>>("/api/runtime-fabric/sessions"),
        "sessions",
      ),
      getSession: async (id) => unwrap<RuntimeSession>(
        await request<Record<string, unknown>>(
          `/api/runtime-fabric/sessions/${encodeURIComponent(id)}`,
        ),
        "session",
      ),
      getScreen: async (id, lines = 220) => unwrap<RuntimeSessionScreen>(
        await request<Record<string, unknown>>(
          `/api/runtime-fabric/sessions/${encodeURIComponent(id)}/screen?lines=${lines}`,
        ),
        "screen",
      ),
      createSession: async (input) => unwrap<RuntimeSession>(
        await post<Record<string, unknown>>("/api/runtime-fabric/sessions", input),
        "session",
      ),
      dispatch: async (input) =>
        await post<{ session: RuntimeSession; screen: RuntimeSessionScreen }>(
          "/api/runtime-fabric/dispatch",
          input,
        ),
      sendInput: async (id, input) => unwrap<RuntimeSession>(
        await post<Record<string, unknown>>(
          `/api/runtime-fabric/sessions/${encodeURIComponent(id)}/input`,
          input,
        ),
        "session",
      ),
      stopSession: async (id) => unwrap<RuntimeSession>(
        await post<Record<string, unknown>>(
          `/api/runtime-fabric/sessions/${encodeURIComponent(id)}/stop`,
          {},
        ),
        "session",
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
