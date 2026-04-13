export type ExecutionMode =
  | "research"
  | "outline"
  | "implement"
  | "review"
  | "harvest"
  | "refactor";

export type ExecutionStatus =
  | "created"
  | "proposed"
  | "awaiting_approval"
  | "approved"
  | "delegated"
  | "running"
  | "harvesting"
  | "completed"
  | "failed"
  | "cancelled";

export interface Execution {
  readonly id: string;
  readonly title: string;
  readonly objective: string | null;
  readonly mode: ExecutionMode;
  readonly status: ExecutionStatus;
  readonly project_slug: string | null;
  readonly intent_slug: string | null;
  readonly intent_path: string | null;
  readonly result_path: string | null;
  readonly requires_approval: boolean;
  readonly brain_dump_item_id: string | null;
  readonly proposal_id: string | null;
  readonly completed_at: string | null;
  readonly inserted_at: string;
  readonly updated_at: string;
}

export interface ExecutionEvent {
  readonly id: string;
  readonly type: string;
  readonly at: string;
  readonly actor_kind: string | null;
  readonly payload: Record<string, unknown> | null;
}

export interface AgentSession {
  readonly id: string;
  readonly agent_role: string | null;
  readonly status: string;
  readonly started_at: string | null;
  readonly ended_at: string | null;
}
