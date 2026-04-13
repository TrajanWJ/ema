export interface Project {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: "incubating" | "active" | "paused" | "completed" | "archived";
  readonly icon: string | null;
  readonly color: string | null;
  readonly linked_path: string | null;
  readonly parent_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly task_count?: number;
  readonly proposal_count?: number;
}
