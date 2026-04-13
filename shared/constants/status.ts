export const TASK_STATUSES = {
  proposed: "proposed",
  planned: "planned",
  in_progress: "in_progress",
  blocked: "blocked",
  done: "done",
  cancelled: "cancelled",
} as const;

export const TASK_PRIORITIES = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
} as const;

export const TASK_EFFORTS = {
  trivial: "trivial",
  small: "small",
  medium: "medium",
  large: "large",
  epic: "epic",
} as const;

export const PROJECT_STATUSES = {
  active: "active",
  paused: "paused",
  completed: "completed",
  archived: "archived",
} as const;

export const PROPOSAL_STATUSES = {
  generating: "generating",
  refining: "refining",
  debating: "debating",
  tagging: "tagging",
  queued: "queued",
  approved: "approved",
  redirected: "redirected",
  killed: "killed",
  cancelled: "cancelled",
} as const;

export const INTENT_LEVELS = {
  vision: "vision",
  strategy: "strategy",
  objective: "objective",
  initiative: "initiative",
  execution: "execution",
  task: "task",
} as const;

export const INTENT_STATUSES = {
  draft: "draft",
  active: "active",
  paused: "paused",
  completed: "completed",
  abandoned: "abandoned",
} as const;

export const AGENT_STATUSES = {
  active: "active",
  paused: "paused",
  disabled: "disabled",
} as const;

export const HABIT_CADENCES = {
  daily: "daily",
  weekly: "weekly",
} as const;

export const BRAIN_DUMP_SOURCES = {
  text: "text",
  shortcut: "shortcut",
  clipboard: "clipboard",
  voice: "voice",
  agent: "agent",
} as const;
