export type CalendarEntryKind =
  | "human_commitment"
  | "human_focus_block"
  | "agent_virtual_block"
  | "milestone";

export type CalendarEntryStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface CalendarEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly entry_kind: CalendarEntryKind;
  readonly status: CalendarEntryStatus;
  readonly owner_kind: "human" | "agent";
  readonly owner_id: string;
  readonly starts_at: string;
  readonly ends_at: string | null;
  readonly phase: "idle" | "plan" | "execute" | "review" | "retro" | null;
  readonly buildout_id: string | null;
  readonly goal_id: string | null;
  readonly task_id: string | null;
  readonly project_id: string | null;
  readonly space_id: string | null;
  readonly intent_slug: string | null;
  readonly execution_id: string | null;
  readonly location: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}
