export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly timeframe: GoalTimeframe;
  readonly status: GoalStatus;
  readonly parent_id: string | null;
  readonly project_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export type GoalTimeframe = "weekly" | "monthly" | "quarterly" | "yearly" | "3year";
export type GoalStatus = "active" | "completed" | "archived";

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
