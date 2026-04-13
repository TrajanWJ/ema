import type { InboxItem } from "@/types/brain-dump";
import type { CalendarEntry } from "@/types/calendar";
import type { Goal } from "@/types/goals";
import type { Task } from "@/types/tasks";
import type { UserStateHistoryEntry, UserStateSnapshot } from "@/types/user-state";

export interface HumanOpsDay {
  readonly date: string;
  readonly plan: string;
  readonly linked_goal_id: string | null;
  readonly now_task_id: string | null;
  readonly pinned_task_ids: readonly string[];
  readonly review_note: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface HumanOpsAgentScheduleGroup {
  readonly owner_id: string;
  readonly entries: readonly CalendarEntry[];
}

export interface HumanOpsDailyBrief {
  readonly date: string;
  readonly day: HumanOpsDay;
  readonly inbox: readonly InboxItem[];
  readonly actionable_tasks: readonly Task[];
  readonly overdue_tasks: readonly Task[];
  readonly pinned_tasks: readonly Task[];
  readonly suggested_tasks: readonly Task[];
  readonly now_task: Task | null;
  readonly recent_wins: readonly Task[];
  readonly active_goals: readonly Goal[];
  readonly linked_goal: Goal | null;
  readonly human_schedule: readonly CalendarEntry[];
  readonly agent_schedule: readonly HumanOpsAgentScheduleGroup[];
  readonly user_state: {
    readonly current: UserStateSnapshot;
    readonly history: readonly UserStateHistoryEntry[];
  };
  readonly next_action_label: string;
  readonly recovery_items: readonly string[];
  readonly commitments_at_risk: readonly CalendarEntry[];
}

export interface HumanOpsAgendaItem {
  readonly date: string;
  readonly entry: CalendarEntry;
  readonly goal: Goal | null;
  readonly task: Task | null;
  readonly is_today: boolean;
  readonly is_overdue: boolean;
  readonly is_happening_now: boolean;
}

export interface HumanOpsAgendaDay {
  readonly date: string;
  readonly is_today: boolean;
  readonly human_count: number;
  readonly agent_count: number;
  readonly entries: readonly HumanOpsAgendaItem[];
}

export interface HumanOpsAgenda {
  readonly anchor_date: string;
  readonly horizon_days: number;
  readonly days: readonly HumanOpsAgendaDay[];
  readonly at_risk_entries: readonly HumanOpsAgendaItem[];
}
