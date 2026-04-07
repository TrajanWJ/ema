export interface IntentNode {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly level: number;
  readonly kind: string;
  readonly status: string;
  readonly phase: number;
  readonly priority: number;
  readonly completion_pct: number;
  readonly project_id: string | null;
  readonly parent_id: string | null;
  readonly description: string | null;
  readonly children: IntentNode[];
}

export interface IntentDetail {
  readonly intent: IntentNode;
  readonly links: IntentLink[];
  readonly lineage: IntentEvent[];
}

export interface IntentLink {
  readonly id: string;
  readonly intent_id: string;
  readonly linkable_type: string;
  readonly linkable_id: string;
  readonly role: string;
  readonly provenance: string;
}

export interface IntentEvent {
  readonly id: string;
  readonly intent_id: string;
  readonly event_type: string;
  readonly payload: Record<string, unknown>;
  readonly actor: string;
  readonly inserted_at: string;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: string;
}

export interface Highlight {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly comment: string;
  readonly actor_id: string;
  readonly created_at: string;
}

export const LEVEL_LABELS: Record<number, string> = {
  0: "Vision",
  1: "Goal",
  2: "Project",
  3: "Feature",
  4: "Task",
  5: "Execution",
};

export const LEVEL_ICONS: Record<number, string> = {
  0: "◉",
  1: "◎",
  2: "◆",
  3: "▸",
  4: "·",
  5: "›",
};

export const STATUS_COLORS: Record<string, string> = {
  planned: "#64748b",
  active: "#2dd4a8",
  researched: "#6b95f0",
  outlined: "#a78bfa",
  implementing: "#f59e0b",
  complete: "#22c55e",
  blocked: "#ef4444",
  archived: "#475569",
};
