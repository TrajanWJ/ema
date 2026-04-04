export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: "proposed" | "todo" | "in_progress" | "blocked" | "in_review" | "done" | "archived" | "cancelled" | "requires_proposal";
  readonly priority: number;
  readonly source_type: string | null;
  readonly source_id: string | null;
  readonly effort: string | null;
  readonly due_date: string | null;
  readonly project_id: string | null;
  readonly parent_id: string | null;
  readonly completed_at: string | null;
  readonly created_at: string;
}

export interface TaskComment {
  readonly id: string;
  readonly body: string;
  readonly source: "user" | "system" | "agent";
  readonly created_at: string;
}
