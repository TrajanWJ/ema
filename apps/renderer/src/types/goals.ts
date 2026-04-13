export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly timeframe: GoalTimeframe;
  readonly status: GoalStatus;
  readonly owner_kind: GoalOwnerKind;
  readonly owner_id: string;
  readonly parent_id: string | null;
  readonly project_id: string | null;
  readonly space_id: string | null;
  readonly intent_slug: string | null;
  readonly target_date: string | null;
  readonly success_criteria: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export type GoalTimeframe = "weekly" | "monthly" | "quarterly" | "yearly" | "3year";
export type GoalStatus = "active" | "completed" | "archived";
export type GoalOwnerKind = "human" | "agent";

export interface GoalProposal {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly revision: number;
  readonly updated_at: string;
}

export interface GoalExecution {
  readonly id: string;
  readonly title: string;
  readonly mode: string;
  readonly status: string;
  readonly proposal_id: string | null;
  readonly current_phase?: string | null;
  readonly result_summary?: string | null;
  readonly updated_at: string;
}

export interface GoalCalendarEntry {
  readonly id: string;
  readonly title: string;
  readonly entry_kind: string;
  readonly status: string;
  readonly phase: string | null;
  readonly buildout_id: string | null;
  readonly execution_id: string | null;
  readonly starts_at: string;
  readonly ends_at: string | null;
}

export interface GoalBuildout {
  readonly buildout_id: string;
  readonly entries: readonly GoalCalendarEntry[];
}

export interface GoalContext {
  readonly goal: Goal;
  readonly children: readonly Goal[];
  readonly proposals: readonly GoalProposal[];
  readonly executions: readonly GoalExecution[];
  readonly calendar_entries: readonly GoalCalendarEntry[];
  readonly active_buildouts: readonly GoalBuildout[];
}

export const TIMEFRAME_LABELS: Record<GoalTimeframe, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  "3year": "3-Year",
} as const;

export const TIMEFRAME_ORDER: readonly GoalTimeframe[] = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "3year",
] as const;

export const STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
} as const;
