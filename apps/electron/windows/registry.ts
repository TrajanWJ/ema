import { APP_WINDOW_DEFAULTS, type WindowConfig } from "./config";

export const KNOWN_APP_IDS = [
  "desk",
  "agenda",
  "brain-dump",
  "tasks",
  "projects",
  "executions",
  "proposals",
  "blueprint-planner",
  "intent-schematic",
  "wiki",
  "agents",
  "feeds",
  "canvas",
  "pipes",
  "evolution",
  "whiteboard",
  "storyboard",
  "decision-log",
  "campaigns",
  "governance",
  "babysitter",
  "habits",
  "journal",
  "focus",
  "responsibilities",
  "temporal",
  "goals",
  "settings",
  "terminal",
  "voice",
  "hq",
  "pattern-lab",
  "operator-chat",
  "agent-chat",
] as const;

export type KnownAppId = (typeof KNOWN_APP_IDS)[number];

export type AppWindowRegistration = WindowConfig & {
  readonly title: string;
};

function withDefaults(
  title: string,
  category: keyof typeof APP_WINDOW_DEFAULTS,
  overrides: Partial<WindowConfig> = {},
): AppWindowRegistration {
  return {
    title,
    ...APP_WINDOW_DEFAULTS[category],
    ...overrides,
  };
}

const REGISTRY: Record<KnownAppId, AppWindowRegistration> = {
  hq: withDefaults("HQ", "wide", { width: 1100, height: 800 }),
  desk: withDefaults("Desk", "wide", { width: 1280, height: 860, minWidth: 960, minHeight: 680 }),
  agenda: withDefaults("Agenda", "wide", { width: 1180, height: 820, minWidth: 920, minHeight: 640 }),
  "brain-dump": withDefaults("Brain Dump", "compact", { width: 600, height: 700, minWidth: 480, minHeight: 400 }),
  tasks: withDefaults("Tasks", "standard", { width: 900, height: 700, minWidth: 700, minHeight: 500 }),
  projects: withDefaults("Projects", "standard", { width: 900, height: 700, minWidth: 700, minHeight: 500 }),
  executions: withDefaults("Executions", "wide", { width: 1000, height: 750, minWidth: 800, minHeight: 600 }),
  proposals: withDefaults("Proposals", "standard", { width: 900, height: 700, minWidth: 700, minHeight: 500 }),
  "blueprint-planner": withDefaults("Blueprint Planner", "wide", { width: 1200, height: 850, minWidth: 900, minHeight: 600 }),
  "intent-schematic": withDefaults("Intent Schematic", "wide", { width: 1200, height: 800, minWidth: 900, minHeight: 600 }),
  wiki: withDefaults("Wiki", "wide", { width: 1000, height: 750, minWidth: 800, minHeight: 600 }),
  agents: withDefaults("Agents", "standard", { width: 900, height: 700, minWidth: 700, minHeight: 500 }),
  feeds: withDefaults("Feeds", "wide", { width: 1320, height: 860, minWidth: 980, minHeight: 640 }),
  canvas: withDefaults("Canvas", "wide", { width: 1100, height: 800, minWidth: 900, minHeight: 650 }),
  pipes: withDefaults("Pipes", "standard", { width: 900, height: 700, minWidth: 700, minHeight: 500 }),
  evolution: withDefaults("Evolution", "standard", { width: 900, height: 700, minWidth: 700, minHeight: 500 }),
  whiteboard: withDefaults("Whiteboard", "wide", { width: 1100, height: 800, minWidth: 800, minHeight: 600 }),
  storyboard: withDefaults("Storyboard", "wide", { width: 1000, height: 750, minWidth: 800, minHeight: 600 }),
  "decision-log": withDefaults("Decision Log", "wide", { width: 1000, height: 700, minWidth: 800, minHeight: 550 }),
  campaigns: withDefaults("Campaigns", "standard", { width: 950, height: 700, minWidth: 800, minHeight: 500 }),
  governance: withDefaults("Governance", "standard", { width: 800, height: 650, minWidth: 600, minHeight: 450 }),
  babysitter: withDefaults("Babysitter", "standard", { width: 800, height: 650, minWidth: 600, minHeight: 450 }),
  habits: withDefaults("Habits", "compact", { width: 650, height: 700, minWidth: 500, minHeight: 400 }),
  journal: withDefaults("Journal", "standard", { width: 800, height: 700, minWidth: 600, minHeight: 500 }),
  focus: withDefaults("Focus", "standard", { width: 700, height: 650, minWidth: 500, minHeight: 450 }),
  responsibilities: withDefaults("Responsibilities", "standard", { width: 800, height: 650, minWidth: 600, minHeight: 450 }),
  temporal: withDefaults("Rhythm", "standard", { width: 800, height: 650, minWidth: 700, minHeight: 500 }),
  goals: withDefaults("Goals", "standard", { width: 800, height: 700, minWidth: 600, minHeight: 500 }),
  settings: withDefaults("Settings", "compact", { width: 600, height: 600, minWidth: 500, minHeight: 400 }),
  terminal: withDefaults("Terminal", "wide", { width: 1240, height: 840, minWidth: 920, minHeight: 620 }),
  "pattern-lab": withDefaults("Pattern Lab", "wide", { width: 1360, height: 900, minWidth: 1040, minHeight: 720 }),
  voice: withDefaults("Voice", "standard", { width: 900, height: 700, minWidth: 700, minHeight: 500 }),
  "operator-chat": withDefaults("Operator Chat", "compact", { width: 700, height: 750, minWidth: 500, minHeight: 500 }),
  "agent-chat": withDefaults("Agent Chat", "compact", { width: 700, height: 750, minWidth: 500, minHeight: 500 }),
};

export function isKnownAppId(value: string): value is KnownAppId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, value);
}

export function getAppRegistration(appId: KnownAppId): AppWindowRegistration {
  return REGISTRY[appId];
}
