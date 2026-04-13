/**
 * Current EMA backend manifest.
 *
 * Purpose:
 *   - Make the active backend surface explicit instead of depending on
 *     directory scanning and historical inference.
 *   - Give future agents one inspectable module that states which domains
 *     are active now, which storage layers exist, and which duplicate
 *     architectures are future/deferred.
 *
 * This manifest is intentionally biased toward the currently wired backend:
 *   ema-genesis/filesystem canon -> SQLite mirror -> runtime services.
 */

export type BackendLayerKind =
  | "canonical_semantic"
  | "indexed_operational"
  | "runtime_service"
  | "interface"
  | "generated_artifact"
  | "ephemeral";

export interface BackendLayer {
  id: string;
  kind: BackendLayerKind;
  label: string;
  description: string;
  source_of_truth: "primary" | "derived" | "ephemeral";
}

export interface BackendStorageBoundary {
  id: string;
  kind: BackendLayerKind;
  durability: "durable" | "derived" | "ephemeral";
  location: string;
  role: string;
}

export interface BackendDomainRegistration {
  domain: string;
  router_entrypoint: string;
  mount_prefixes: string[];
  category: "active" | "supporting";
  owner: string;
  notes: string;
}

export interface BackendEntityDefinition {
  id: string;
  purpose: string;
  source_of_truth: string;
  persistence: string[];
  owner: string;
  state_kind: "canonical" | "mirror" | "operational" | "generated";
  status: "active" | "supporting" | "future";
  lifecycle?: string[];
  extension_notes?: string;
}

export interface BackendDeduplicationDecision {
  concept: string;
  active: string;
  future?: string;
  ignore_for_now?: string;
  rationale: string;
}

export const BACKEND_LAYERS: readonly BackendLayer[] = [
  {
    id: "canon",
    kind: "canonical_semantic",
    label: "Canonical Semantic Layer",
    description:
      "Filesystem-backed semantic truth. Today this is primarily ema-genesis plus intent markdown sources.",
    source_of_truth: "primary",
  },
  {
    id: "sqlite",
    kind: "indexed_operational",
    label: "Indexed Operational Layer",
    description:
      "SQLite mirror and local runtime persistence used by services, joins, transitions, and operational state.",
    source_of_truth: "derived",
  },
  {
    id: "services",
    kind: "runtime_service",
    label: "Runtime Services Layer",
    description:
      "TypeScript service modules, routes, websocket adapters, and worker-facing seams.",
    source_of_truth: "derived",
  },
  {
    id: "artifacts",
    kind: "generated_artifact",
    label: "Generated Artifact Layer",
    description:
      "Prompt/context/result files produced by runs. Durable evidence, not canonical control-plane truth.",
    source_of_truth: "derived",
  },
  {
    id: "interfaces",
    kind: "interface",
    label: "Interface Layer",
    description:
      "CLI, renderer, and future agent surfaces. These should consume backend contracts, not invent them.",
    source_of_truth: "derived",
  },
  {
    id: "ephemeral",
    kind: "ephemeral",
    label: "Ephemeral Runtime Layer",
    description:
      "PubSub, websocket subscriptions, worker timers, and in-memory visibility state.",
    source_of_truth: "ephemeral",
  },
] as const;

export const BACKEND_STORAGE_BOUNDARIES: readonly BackendStorageBoundary[] = [
  {
    id: "ema_genesis",
    kind: "canonical_semantic",
    durability: "durable",
    location: "repo:ema-genesis/",
    role: "Primary semantic canon, especially intents and GAC cards.",
  },
  {
    id: "intent_sources",
    kind: "canonical_semantic",
    durability: "durable",
    location: "repo:ema-genesis/intents + repo:.superman/intents",
    role: "Filesystem-backed intent sources consumed by the active intent indexer.",
  },
  {
    id: "runtime_db",
    kind: "indexed_operational",
    durability: "durable",
    location: "~/.local/share/ema/ema.db",
    role: "Primary local runtime persistence and query layer.",
  },
  {
    id: "vault",
    kind: "canonical_semantic",
    durability: "durable",
    location: "~/.local/share/ema/vault",
    role: "Historical knowledge substrate and harvested source material. Low-trust for current runtime truth.",
  },
  {
    id: "chronicle_raw",
    kind: "generated_artifact",
    durability: "durable",
    location: "~/.local/share/ema/chronicle",
    role: "Raw Chronicle payloads, normalized session bundles, and stored imported artifacts.",
  },
  {
    id: "artifacts",
    kind: "generated_artifact",
    durability: "durable",
    location: "~/.local/share/ema/artifacts",
    role: "Per-run prompt/context/response artifacts.",
  },
  {
    id: "results",
    kind: "generated_artifact",
    durability: "durable",
    location: "~/.local/share/ema/results",
    role: "Execution result markdown and related output files.",
  },
  {
    id: "pubsub",
    kind: "ephemeral",
    durability: "ephemeral",
    location: "process memory",
    role: "Realtime subscriptions, visibility, and transient event fanout.",
  },
] as const;

export const BACKEND_DOMAINS: readonly BackendDomainRegistration[] = [
  {
    domain: "backend",
    router_entrypoint: "services/core/backend/backend.router.ts",
    mount_prefixes: ["/api/backend"],
    category: "active",
    owner: "backend manifest",
    notes: "Inspection surface for the normalized backend contract.",
  },
  {
    domain: "actors",
    router_entrypoint: "services/core/actors/actors.router.ts",
    mount_prefixes: ["/api/agents"],
    category: "supporting",
    owner: "actors runtime classifier",
    notes: "Supporting ingest surface, not a full actor CRUD domain.",
  },
  {
    domain: "blueprint",
    router_entrypoint: "services/core/blueprint/blueprint.router.ts",
    mount_prefixes: ["/api/blueprint"],
    category: "active",
    owner: "blueprint / GAC queue",
    notes: "Filesystem-backed GAC mirror and runtime queue.",
  },
  {
    domain: "brain-dump",
    router_entrypoint: "services/core/brain-dump/brain-dump.router.ts",
    mount_prefixes: ["/api/brain-dump"],
    category: "supporting",
    owner: "brain dump",
    notes: "Operational inbox surface. Not part of the backend spine.",
  },
  {
    domain: "chronicle",
    router_entrypoint: "services/core/chronicle/chronicle.router.ts",
    mount_prefixes: ["/api/chronicle"],
    category: "active",
    owner: "chronicle landing zone",
    notes:
      "Durable landing zone for imported sessions, entries, and artifacts backed by raw files plus SQLite metadata.",
  },
  {
    domain: "dashboard",
    router_entrypoint: "services/core/dashboard/dashboard.router.ts",
    mount_prefixes: ["/api/dashboard"],
    category: "supporting",
    owner: "dashboard read model",
    notes: "Read-model surface over other domains.",
  },
  {
    domain: "calendar",
    router_entrypoint: "services/core/calendar/calendar.router.ts",
    mount_prefixes: ["/api/calendar"],
    category: "active",
    owner: "calendar planning ledger",
    notes:
      "Operational schedule ledger for human commitments and agent virtual planning blocks, including phased buildouts.",
  },
  {
    domain: "human-ops",
    router_entrypoint: "services/core/human-ops/human-ops.router.ts",
    mount_prefixes: ["/api/human-ops"],
    category: "active",
    owner: "human ops day ledger",
    notes:
      "Single-day human operating record plus derived daily schedule views for planning, linked goals, now tasks, pinned tasks, and review notes.",
  },
  {
    domain: "feeds",
    router_entrypoint: "services/core/feeds/feeds.router.ts",
    mount_prefixes: ["/api/feeds"],
    category: "supporting",
    owner: "feeds workspace",
    notes:
      "Operational feed workspace for reader, triage, and agent-console surfaces over ranked source material.",
  },
  {
    domain: "executions",
    router_entrypoint: "services/core/executions/executions.router.ts",
    mount_prefixes: ["/api/executions"],
    category: "active",
    owner: "pluralized executions service",
    notes:
      "Current operational execution ledger, including progress, result attachment, and completion.",
  },
  {
    domain: "intents",
    router_entrypoint: "services/core/intents/intents.router.ts",
    mount_prefixes: ["/api/intents"],
    category: "active",
    owner: "pluralized intents service",
    notes:
      "Filesystem-backed semantic intent bridge and SQLite index, including the intent-anchored execution start seam.",
  },
  {
    domain: "ingestion",
    router_entrypoint: "services/core/ingestion/ingestion.router.ts",
    mount_prefixes: ["/api/ingestion"],
    category: "supporting",
    owner: "ingestion archaeology seam",
    notes:
      "Discovery and parsing seam for local agent histories. Chronicle is the durable landing zone it now feeds.",
  },
  {
    domain: "goals",
    router_entrypoint: "services/core/goals/goals.router.ts",
    mount_prefixes: ["/api/goals"],
    category: "active",
    owner: "goals",
    notes:
      "Operational human and agent goals linked back to intent, project, and space context.",
  },
  {
    domain: "human-ops",
    router_entrypoint: "services/core/human-ops/human-ops.router.ts",
    mount_prefixes: ["/api/human-ops"],
    category: "active",
    owner: "personal operating layer",
    notes:
      "Persisted day object plus derived daily brief and agenda read models over inbox, tasks, goals, calendar, user-state, and agent agenda.",
  },
  {
    domain: "memory",
    router_entrypoint: "services/core/memory/memory.router.ts",
    mount_prefixes: ["/api/memory"],
    category: "supporting",
    owner: "memory / cross-pollination",
    notes: "Supporting append-only memory surface; not part of the active spine.",
  },
  {
    domain: "pipes",
    router_entrypoint: "services/core/pipes/pipes.router.ts",
    mount_prefixes: ["/api/pipes"],
    category: "supporting",
    owner: "pipes",
    notes: "Framework for automations. Present, but not part of the minimum loop.",
  },
  {
    domain: "projects",
    router_entrypoint: "services/core/projects/projects.router.ts",
    mount_prefixes: ["/api/projects"],
    category: "supporting",
    owner: "projects",
    notes: "Operational CRUD. Useful context, not a source-of-truth layer.",
  },
  {
    domain: "proposal",
    router_entrypoint: "services/core/proposal/router.ts",
    mount_prefixes: ["/api/proposals"],
    category: "active",
    owner: "durable proposal service",
    notes:
      "SQLite-backed proposal lifecycle between runtime intents and executions. Harvesters remain supporting inputs behind this surface.",
  },
  {
    domain: "review",
    router_entrypoint: "services/core/review/review.router.ts",
    mount_prefixes: ["/api/review"],
    category: "active",
    owner: "review decision layer",
    notes:
      "Chronicle-backed decision queue that records review items, decision history, and promotion receipts with provenance.",
  },
  {
    domain: "runtime-fabric",
    router_entrypoint: "services/core/runtime-fabric/runtime-fabric.router.ts",
    mount_prefixes: ["/api/runtime-fabric"],
    category: "active",
    owner: "tmux-backed local runtime fabric",
    notes:
      "Active runtime/session control plane for logged-in coding-agent CLIs, managed tmux sessions, prompt dispatch, input relay, and terminal capture.",
  },
  {
    domain: "settings",
    router_entrypoint: "services/core/settings/settings.router.ts",
    mount_prefixes: ["/api/settings"],
    category: "supporting",
    owner: "settings",
    notes: "Operational app settings storage.",
  },
  {
    domain: "spaces",
    router_entrypoint: "services/core/spaces/spaces.router.ts",
    mount_prefixes: ["/api/spaces"],
    category: "active",
    owner: "spaces",
    notes: "Minimal contextual container around work and user state.",
  },
  {
    domain: "tasks",
    router_entrypoint: "services/core/tasks/tasks.router.ts",
    mount_prefixes: ["/api/tasks"],
    category: "supporting",
    owner: "tasks",
    notes: "Operational work items. Not the active semantic spine.",
  },
  {
    domain: "voice",
    router_entrypoint: "services/core/voice/voice.router.ts",
    mount_prefixes: ["/api/voice", "/phone/voice"],
    category: "supporting",
    owner: "voice relay",
    notes: "Phone pairing, QR generation, and local Jarvis mic relay.",
  },
  {
    domain: "user-state",
    router_entrypoint: "services/core/user-state/user-state.router.ts",
    mount_prefixes: ["/api/user-state"],
    category: "active",
    owner: "user state",
    notes: "Persisted runtime user mode and signals.",
  },
  {
    domain: "visibility",
    router_entrypoint: "services/core/visibility/visibility.router.ts",
    mount_prefixes: ["/api/visibility"],
    category: "supporting",
    owner: "visibility",
    notes: "Intentionally ephemeral visibility/read-model surface.",
  },
  {
    domain: "workspace",
    router_entrypoint: "services/core/workspace/workspace.router.ts",
    mount_prefixes: ["/api/workspace"],
    category: "supporting",
    owner: "workspace",
    notes: "Desktop/UI runtime state, not semantic backend truth.",
  },
] as const;

export const ACTIVE_BACKEND_ENTITIES: readonly BackendEntityDefinition[] = [
  {
    id: "intent",
    purpose: "Canonical work unit mirrored from filesystem into runtime state.",
    source_of_truth: "Filesystem intent sources under ema-genesis/.superman; SQLite row is a mirror.",
    persistence: ["ema-genesis/intents", ".superman/intents", "sqlite:intents"],
    owner: "services/core/intents",
    state_kind: "mirror",
    status: "active",
    lifecycle: ["filesystem authored", "indexed", "phase/status updated", "linked to executions"],
    extension_notes:
      "Prefer extending intent links/events before inventing a second semantic work object.",
  },
  {
    id: "gac_card",
    purpose: "Canonical unresolved architecture/governance card.",
    source_of_truth: "Filesystem GAC markdown; SQLite row is a mirror.",
    persistence: ["ema-genesis/intents/GAC-*", "sqlite:gac_cards"],
    owner: "services/core/blueprint",
    state_kind: "mirror",
    status: "active",
    lifecycle: ["filesystem authored", "indexed", "answered/deferred/promoted"],
  },
  {
    id: "space",
    purpose: "Minimal contextual container for work, users, and future containment.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:spaces", "sqlite:space_members", "sqlite:space_transitions"],
    owner: "services/core/spaces",
    state_kind: "operational",
    status: "active",
    lifecycle: ["created", "active", "archived"],
  },
  {
    id: "proposal",
    purpose: "Durable review and approval object between intents and executions.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:loop_proposals", "sqlite:loop_events"],
    owner: "services/core/proposal",
    state_kind: "operational",
    status: "active",
    lifecycle: [
      "generated",
      "pending_approval",
      "approved/rejected",
      "revised/superseded",
      "execution started",
    ],
    extension_notes:
      "Harvested proposal seeds are inputs into this lifecycle, not a second proposal system.",
  },
  {
    id: "execution",
    purpose: "Operational run ledger linked back to intents and, when present, approved proposals.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:executions", "sqlite:execution_phase_transitions"],
    owner: "services/core/executions",
    state_kind: "operational",
    status: "active",
    lifecycle: ["created", "awaiting_approval", "approved", "running", "completed/failed/cancelled"],
    extension_notes:
      "Treat result_path/result_summary as first-class outputs. `proposal_id` is the preferred handoff from approved proposals; direct intent->execution remains a compatibility shortcut.",
  },
  {
    id: "goal",
    purpose: "Operational owned objective for a human or agent, optionally linked to intent/project/space context.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:goals"],
    owner: "services/core/goals",
    state_kind: "operational",
    status: "active",
    lifecycle: ["created", "active", "completed/archived"],
    extension_notes:
      "Goals are operational planning state. They should link to intents rather than replacing the canon-backed intent layer.",
  },
  {
    id: "chronicle_session",
    purpose:
      "Durable imported-session and raw-history record that preserves provenance before later review and promotion.",
    source_of_truth: "Raw Chronicle files under ~/.local/share/ema/chronicle plus SQLite query metadata.",
    persistence: [
      "~/.local/share/ema/chronicle/sessions/*",
      "sqlite:chronicle_sources",
      "sqlite:chronicle_sessions",
      "sqlite:chronicle_entries",
      "sqlite:chronicle_artifacts",
    ],
    owner: "services/core/chronicle",
    state_kind: "operational",
    status: "active",
    lifecycle: ["imported", "normalized", "browsed", "linked/promoted later"],
    extension_notes:
      "Chronicle is the arrival and provenance layer. Review, dedupe, and promotion should extend this domain rather than bypassing it.",
  },
  {
    id: "chronicle_extraction",
    purpose:
      "Durable Chronicle-derived candidate extracted from session entries or artifacts before human review and promotion.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:chronicle_extractions"],
    owner: "services/core/review",
    state_kind: "operational",
    status: "active",
    lifecycle: ["generated", "reviewed", "promoted/superseded"],
    extension_notes:
      "Chronicle extractions are candidate objects only. They must retain Chronicle lineage and never replace raw imported Chronicle storage.",
  },
  {
    id: "review_item",
    purpose:
      "Durable human or agent review unit linked to one Chronicle extraction before promotion into structured work.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:review_items"],
    owner: "services/core/review",
    state_kind: "operational",
    status: "active",
    lifecycle: ["created", "pending", "approved/rejected/deferred", "promoted/superseded"],
    extension_notes:
      "Review is the decision boundary above Chronicle. It should preserve provenance, not replace Chronicle raw/session storage.",
  },
  {
    id: "promotion_receipt",
    purpose:
      "Durable provenance-preserving bridge from an approved review item into a downstream target or recorded follow-on destination.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:promotion_receipts"],
    owner: "services/core/review",
    state_kind: "operational",
    status: "active",
    lifecycle: ["recorded", "linked", "queried alongside review history"],
    extension_notes:
      "Receipts preserve downstream provenance without forcing automatic creation of intents, proposals, or executions in this pass.",
  },
  {
    id: "calendar_entry",
    purpose: "Operational schedule ledger for human commitments and agent virtual planning blocks.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:calendar_entries"],
    owner: "services/core/calendar",
    state_kind: "operational",
    status: "active",
    lifecycle: [
      "scheduled",
      "in_progress",
      "completed/cancelled",
      "optionally grouped into phased buildouts",
    ],
    extension_notes:
      "Keep scheduling state here. The old temporal and calendar-driver systems remain historical context, not current storage truth.",
  },
  {
    id: "human_ops_day",
    purpose:
      "Single-day human operating record linking plan, goal, now task, pinned tasks, and review note.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:human_ops_days"],
    owner: "services/core/human-ops",
    state_kind: "operational",
    status: "active",
    lifecycle: ["created", "updated", "reviewed", "reset"],
  },
  {
    id: "result_artifact",
    purpose: "Durable output file or result path produced by an execution.",
    source_of_truth: "Filesystem artifact/result files plus the execution row pointer.",
    persistence: ["~/.local/share/ema/results", "sqlite:executions.result_path"],
    owner: "services/core/executions + services/core/composer",
    state_kind: "generated",
    status: "active",
    lifecycle: ["written", "attached to execution", "consumed by interfaces"],
  },
  {
    id: "user_state",
    purpose: "Persisted runtime mode and user signals.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:user_state_current", "sqlite:user_state_snapshots"],
    owner: "services/core/user-state",
    state_kind: "operational",
    status: "active",
  },
  {
    id: "proposal_seed",
    purpose: "Read-only harvested suggestion derived from vault, brain dump, or intent bundle.",
    source_of_truth: "Derived from other sources",
    persistence: ["vault markdown", "brain dump json", "runtime bundles"],
    owner: "services/core/proposals",
    state_kind: "generated",
    status: "supporting",
    extension_notes:
      "Useful as inputs. Not a durable proposal workflow object in the active backend.",
  },
  {
    id: "feed_item",
    purpose: "Operational ranked source item that can be saved, promoted, hidden, or routed into agent work.",
    source_of_truth: "SQLite",
    persistence: [
      "sqlite:feed_items",
      "sqlite:feed_item_actions",
      "sqlite:feed_conversations",
    ],
    owner: "services/core/feeds",
    state_kind: "operational",
    status: "supporting",
    lifecycle: [
      "seeded/ingested",
      "ranked per view",
      "saved/promoted/hidden",
      "routed to research/build/chat",
    ],
    extension_notes:
      "Acts as a staging object between external source material and durable work entities.",
  },
  {
    id: "feed_view",
    purpose: "Promptable ranking surface scoped to personal, global, space, or organization contexts.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:feed_views"],
    owner: "services/core/feeds",
    state_kind: "operational",
    status: "supporting",
    lifecycle: ["created", "prompt-tuned", "shared", "consumed by renderer"],
  },
  {
    id: "project",
    purpose: "Operational container for tasks/executions and local grouping.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:projects"],
    owner: "services/core/projects",
    state_kind: "operational",
    status: "supporting",
  },
  {
    id: "task",
    purpose: "Operational work item and checklist surface.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:tasks", "sqlite:task_comments"],
    owner: "services/core/tasks",
    state_kind: "operational",
    status: "supporting",
  },
  {
    id: "brain_dump",
    purpose: "Operational inbox capture for unstructured input.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:inbox_items"],
    owner: "services/core/brain-dump",
    state_kind: "operational",
    status: "supporting",
  },
  {
    id: "human_ops_day",
    purpose: "Persisted day-level operating context for the human desk surface.",
    source_of_truth: "SQLite",
    persistence: ["sqlite:human_ops_days"],
    owner: "services/core/human-ops",
    state_kind: "operational",
    status: "active",
    lifecycle: ["loaded by date", "updated through desk", "composed into a daily brief"],
    extension_notes:
      "This is a narrow planning object. Keep it as the bridge between operational objects and the Desk read model instead of turning it into a second planner database.",
  },
  {
    id: "human_ops_agenda",
    purpose: "Derived schedule/action read model over calendar entries for Agenda.",
    source_of_truth: "Derived from SQLite calendar_entries plus linked goals/tasks",
    persistence: ["ephemeral API read model"],
    owner: "services/core/human-ops",
    state_kind: "generated",
    status: "active",
    lifecycle: ["composed by date horizon", "consumed by Agenda", "invalidated by calendar mutations"],
    extension_notes:
      "Keep the calendar ledger as storage truth. Agenda is a read/action surface, not a second planning store.",
  },
  {
    id: "runtime_tool",
    purpose: "Detected local CLI runtime/tool inventory, including auth-backed coding-agent CLIs.",
    source_of_truth: "OS PATH + known config dirs, mirrored into SQLite on scan.",
    persistence: ["sqlite:runtime_fabric_tools"],
    owner: "services/core/runtime-fabric",
    state_kind: "operational",
    status: "active",
    lifecycle: ["scanned", "re-scanned", "selected for launch"],
    extension_notes:
      "Tool detection is an operational convenience layer. Real auth still lives in the tool's existing local config and OAuth state.",
  },
  {
    id: "runtime_session",
    purpose: "Managed or discovered tmux-backed terminal session for a local coding agent or shell.",
    source_of_truth: "Live tmux session/pane state, with managed metadata mirrored in SQLite.",
    persistence: ["sqlite:runtime_fabric_sessions", "tmux server state"],
    owner: "services/core/runtime-fabric",
    state_kind: "operational",
    status: "active",
    lifecycle: ["discovered/created", "running", "interactive", "stopped/forgotten"],
    extension_notes:
      "Treat tmux as the runtime truth today. Future node-pty/xterm.js transport can layer on top without replacing the session contract.",
  },
  {
    id: "actor_runtime",
    purpose: "Supporting ingest surface for human/agent runtime state.",
    source_of_truth: "HTTP runtime transitions and worker heartbeats",
    persistence: ["sqlite:runtime-related tables when added later", "ephemeral broadcasts today"],
    owner: "services/core/actors",
    state_kind: "generated",
    status: "future",
    extension_notes:
      "Do not treat as a first-class CRUD entity until the actor service exists.",
  },
] as const;

export const BACKEND_DEDUPLICATION_DECISIONS: readonly BackendDeduplicationDecision[] = [
  {
    concept: "Intent model",
    active: "shared/schemas/intents.ts + services/core/intents/*",
    future: "shared/schemas/intent.ts + services/core/intent/*",
    ignore_for_now: "loop_intents and singular CoreIntent runtime",
    rationale:
      "Pluralized intents are the active filesystem-backed mirror and have actual runtime state in SQLite today.",
  },
  {
    concept: "Execution model",
    active: "shared/schemas/executions.ts + services/core/executions/*",
    future: "shared/schemas/execution.ts + services/core/execution/*",
    ignore_for_now: "loop_executions and singular CoreExecution runtime",
    rationale:
      "Pluralized executions are the only execution ledger wired into routes, websocket handlers, and current DB tables.",
  },
  {
    concept: "Planning model",
    active:
      "shared/schemas/goals.ts + shared/schemas/calendar.ts + services/core/{goals,calendar,human-ops}/*",
    future:
      "automation layered on top of the same goals/calendar ledger",
    ignore_for_now:
      "legacy meetings-only CRUD, temporal heuristics, and the old calendar driver as active foundations",
    rationale:
      "The current backend needs one operational planning layer. Goals hold owned objectives; calendar entries hold scheduled commitments and agent virtual blocks; human-ops owns the persisted day object and daily read model.",
  },
  {
    concept: "Personal operating surface",
    active: "apps/renderer/src/components/{desk,agenda}/* + services/core/human-ops/*",
    future: "review and journal layers fed by the same backend spine",
    ignore_for_now: "standalone journal/focus/responsibilities planner shells as truth surfaces",
    rationale:
      "Desk is the home surface and Agenda is the schedule/action surface because both depend on persisted day state and backend read models rather than local-only planner state.",
  },
  {
    concept: "Proposal model",
    active: "shared/schemas/proposal.ts + services/core/proposal/*",
    future: "supervised proposal-generation workers fed by services/core/proposals/* harvesters",
    ignore_for_now: "renderer-era queue semantics and any second live proposal store",
    rationale:
      "Durable proposals are now part of the active backend loop. Harvesters remain supporting inputs, not a competing runtime model.",
  },
  {
    concept: "CLI surface",
    active: "cli/src/index.ts packaged commander CLI",
    future: "further command consolidation on the same packaged CLI entrypoint",
    ignore_for_now: "scripts/ema and other legacy wrappers",
    rationale:
      "The packaged TypeScript CLI currently runs through cli/src/index.ts. Legacy wrappers describe a broader, older daemon surface.",
  },
  {
    concept: "Runtime / session control surface",
    active: "services/core/runtime-fabric/* + ema runtime ... + renderer Terminal app",
    future: "node-pty/xterm.js transport, richer replay, and execution-dispatcher integration",
    ignore_for_now: "SessionsApp, Claude Bridge, Agent Bridge, and CliManager as live backend truths",
    rationale:
      "The tmux-backed runtime fabric is now the single active path for local coding-agent tool detection, session launch, prompt dispatch, screen capture, and input relay.",
  },
  {
    concept: "Backend loop",
    active:
      "canon/filesystem -> runtime intent mirror -> durable proposals -> executions -> results",
    future: "services/core/loop/* as a supervisor over the same proposal/execution lifecycle",
    ignore_for_now: "treating direct bootstrap loop entities as a second live backend spine",
    rationale:
      "Proposal approval is now a real runtime stage, but the live intent and execution ledgers remain the pluralized runtime surfaces.",
  },
] as const;

export function activeBackendDomains(): readonly string[] {
  return [...new Set(BACKEND_DOMAINS.map((entry) => entry.domain))];
}
