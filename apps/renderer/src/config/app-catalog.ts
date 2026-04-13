export type AppCategory =
  | "daily"
  | "operations"
  | "intelligence"
  | "creative"
  | "life"
  | "system"
  | "communication";

export type AppReadiness = "live" | "partial" | "preview";

export interface AppCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly category: AppCategory;
  readonly readiness: AppReadiness;
  readonly summary: string;
  readonly commandHint?: string;
  readonly showInDock?: boolean;
  readonly featured?: boolean;
}

export interface AppCatalogGroup {
  readonly id: AppCategory;
  readonly label: string;
  readonly description: string;
  readonly apps: readonly AppCatalogEntry[];
}

const CATEGORY_META: Record<AppCategory, { label: string; description: string }> = {
  daily: {
    label: "Daily Core",
    description: "The human day spine: capture, planning, commitments, and active work.",
  },
  operations: {
    label: "Operations",
    description: "Runtime ledgers, queues, oversight, and system-facing work surfaces.",
  },
  intelligence: {
    label: "Intelligence",
    description: "Intent, research, synthesis, blueprint, and agent-native knowledge surfaces.",
  },
  creative: {
    label: "Creative + Spatial",
    description: "Canvas, boards, experiments, and exploratory composition surfaces.",
  },
  life: {
    label: "Life Systems",
    description: "Personal rhythms, focus, reflection, and long-horizon support apps.",
  },
  system: {
    label: "System",
    description: "Platform, voice, settings, and system-health control surfaces.",
  },
  communication: {
    label: "Communication",
    description: "Human-agent and multi-agent messaging surfaces.",
  },
};

export const APP_CATALOG: readonly AppCatalogEntry[] = [
  {
    id: "desk",
    name: "Desk",
    category: "daily",
    readiness: "partial",
    summary: "Integrated daily control room over inbox, tasks, goals, calendar, and human-ops.",
    commandHint: "ema human-ops …",
    showInDock: true,
    featured: true,
  },
  {
    id: "agenda",
    name: "Agenda",
    category: "daily",
    readiness: "partial",
    summary: "Schedule and commitment surface over human-ops and calendar planning blocks.",
    commandHint: "ema calendar …",
    showInDock: true,
    featured: true,
  },
  {
    id: "brain-dump",
    name: "Brain Dump",
    category: "daily",
    readiness: "partial",
    summary: "Fast capture queue for inbox items and execution seeds, with renderer hardening still in progress.",
    showInDock: true,
  },
  {
    id: "tasks",
    name: "Tasks",
    category: "daily",
    readiness: "live",
    summary: "Operational task ledger with real CRUD and channel updates.",
    showInDock: true,
  },
  {
    id: "projects",
    name: "Projects",
    category: "daily",
    readiness: "live",
    summary: "Project context and rollup surface over the active projects service.",
    showInDock: true,
  },
  {
    id: "goals",
    name: "Goals",
    category: "daily",
    readiness: "live",
    summary: "Strongest planning surface today, connected to proposals, buildouts, and executions.",
    commandHint: "ema goal …",
    showInDock: true,
  },
  {
    id: "executions",
    name: "Executions",
    category: "operations",
    readiness: "live",
    summary: "Primary runtime execution ledger with approvals, phases, and result attachment.",
    commandHint: "ema exec …",
    showInDock: true,
    featured: true,
  },
  {
    id: "proposals",
    name: "Proposals",
    category: "operations",
    readiness: "live",
    summary: "Durable proposal queue between intents and executions, backed by the active proposal service.",
    commandHint: "ema backend proposal …",
    showInDock: true,
  },
  {
    id: "decision-log",
    name: "Decision Log",
    category: "operations",
    readiness: "preview",
    summary: "Connected first draft for decision memory, provenance, and future review-led convergence rather than a broken legacy store.",
  },
  {
    id: "campaigns",
    name: "Campaigns",
    category: "operations",
    readiness: "preview",
    summary: "Connected first draft for staged operational work, aligned to live proposals, executions, and pipes instead of dead campaign routes.",
  },
  {
    id: "governance",
    name: "Governance",
    category: "operations",
    readiness: "partial",
    summary: "Connected oversight surface over live executions, proposals, tasks, and agent load with policy controls.",
  },
  {
    id: "babysitter",
    name: "Babysitter",
    category: "operations",
    readiness: "partial",
    summary: "Runtime incident console over stale runs, failures, backlog pressure, and surface-level runbooks.",
  },
  {
    id: "hq",
    name: "HQ",
    category: "operations",
    readiness: "preview",
    summary: "Strategic command-center first draft that links into the real operator surfaces without overselling backend convergence.",
    showInDock: true,
  },
  {
    id: "blueprint-planner",
    name: "Blueprint Planner",
    category: "intelligence",
    readiness: "live",
    summary: "Local GAC review and answer surface backed directly by the active blueprint backend.",
    commandHint: "ema blueprint …",
  },
  {
    id: "intent-schematic",
    name: "Intent Schematic",
    category: "intelligence",
    readiness: "live",
    summary: "Intent explorer over the live runtime bundle with proposal and execution linkage.",
    commandHint: "ema intent …",
    showInDock: true,
  },
  {
    id: "wiki",
    name: "Wiki",
    category: "intelligence",
    readiness: "preview",
    summary: "Knowledge workstation first draft that reframes Wiki around Chronicle, Review, Intents, and Feeds rather than dead vault ownership.",
  },
  {
    id: "agents",
    name: "Agents",
    category: "intelligence",
    readiness: "partial",
    summary: "Honest runtime monitor over live agent heartbeat state; full CRUD is still deferred.",
    commandHint: "ema agent …",
    showInDock: true,
  },
  {
    id: "feeds",
    name: "Feeds",
    category: "intelligence",
    readiness: "partial",
    summary: "Research and source workspace over the supporting feeds backend domain.",
  },
  {
    id: "canvas",
    name: "Canvas",
    category: "creative",
    readiness: "preview",
    summary: "Place-inspired spatial first draft with clear runtime links while durable canvas backend ownership is still deferred.",
    showInDock: true,
    featured: true,
  },
  {
    id: "pipes",
    name: "Pipes",
    category: "creative",
    readiness: "live",
    summary: "Automation and pipe registry surface with a real backend and CLI path.",
    commandHint: "ema pipe …",
    showInDock: true,
  },
  {
    id: "evolution",
    name: "Evolution",
    category: "creative",
    readiness: "preview",
    summary: "Adaptive systems first draft that keeps evolution visible without pretending the legacy backend is live.",
  },
  {
    id: "whiteboard",
    name: "Whiteboard",
    category: "creative",
    readiness: "preview",
    summary: "Standalone spatial shell waiting for a real persistence and collaboration model.",
  },
  {
    id: "storyboard",
    name: "Storyboard",
    category: "creative",
    readiness: "preview",
    summary: "Narrative/sequence workspace retained as a visual shell, not a live system yet.",
  },
  {
    id: "habits",
    name: "Habits",
    category: "life",
    readiness: "preview",
    summary: "Rhythm support first draft that ties habits to Desk, Focus, and reflection instead of dead habits routes.",
  },
  {
    id: "journal",
    name: "Journal",
    category: "life",
    readiness: "preview",
    summary: "Reflection first draft over the live day systems, positioned to feed review and retrospection instead of a dead journal backend.",
  },
  {
    id: "focus",
    name: "Focus",
    category: "life",
    readiness: "preview",
    summary: "Attention workflow first draft aligned to executions, tasks, and agenda instead of a fake isolated timer backend.",
  },
  {
    id: "responsibilities",
    name: "Responsibilities",
    category: "life",
    readiness: "preview",
    summary: "Ownership-mapping first draft that connects responsibility design to goals, projects, and review rather than dead routes.",
  },
  {
    id: "temporal",
    name: "Rhythm",
    category: "life",
    readiness: "preview",
    summary: "Rhythm-intelligence first draft that frames temporal guidance around agenda, focus, and reflection instead of legacy APIs.",
  },
  {
    id: "settings",
    name: "Settings",
    category: "system",
    readiness: "partial",
    summary: "Real settings service plus extra tabs that still reach into partial side domains.",
    showInDock: true,
  },
  {
    id: "terminal",
    name: "Terminal",
    category: "system",
    readiness: "partial",
    summary: "Tmux-backed runtime console over managed coding-agent sessions, prompt dispatch, and external session attach.",
    commandHint: "ema runtime …",
    showInDock: true,
    featured: true,
  },
  {
    id: "voice",
    name: "Voice",
    category: "system",
    readiness: "partial",
    summary: "Voice pairing and phone relay are real; broader voice and Jarvis flows still need convergence.",
    showInDock: true,
  },
  {
    id: "pattern-lab",
    name: "Pattern Lab",
    category: "system",
    readiness: "preview",
    summary: "Design and style laboratory shell without active backend ownership.",
  },
  {
    id: "operator-chat",
    name: "Operator Chat",
    category: "communication",
    readiness: "partial",
    summary: "Operator staging console that captures real requests into Brain Dump through the live backend.",
  },
  {
    id: "agent-chat",
    name: "Agent Chat",
    category: "communication",
    readiness: "partial",
    summary: "Agent request console that queues targeted work for runtime actors while full duplex chat remains deferred.",
  },
] as const;

export const APP_GROUPS: readonly AppCatalogGroup[] = Object.entries(CATEGORY_META)
  .map(([id, meta]) => ({
    id: id as AppCategory,
    label: meta.label,
    description: meta.description,
    apps: APP_CATALOG.filter((entry) => entry.category === id),
  }))
  .filter((group) => group.apps.length > 0);

export const DOCK_APPS: readonly AppCatalogEntry[] = APP_CATALOG.filter((entry) => entry.showInDock);

export const FEATURED_APPS: readonly AppCatalogEntry[] = APP_CATALOG.filter((entry) => entry.featured);

export function getAppCatalogEntry(appId: string): AppCatalogEntry | null {
  return APP_CATALOG.find((entry) => entry.id === appId) ?? null;
}

export function readinessLabel(readiness: AppReadiness): string {
  switch (readiness) {
    case "live":
      return "Live";
    case "partial":
      return "Partial";
    case "preview":
      return "Preview";
  }
}
