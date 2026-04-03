import { create } from "zustand";
import { api } from "@/lib/api";
import type { Execution, ExecutionEvent } from "@/types/executions";

export interface IntentNode {
  readonly intent_slug: string;
  readonly project_slug: string | null;
  readonly status: string;
  readonly completion_pct: number;
  readonly modes_executed: Record<string, string>;
  readonly latest_execution_id: string | null;
  readonly executions: readonly Execution[];
}

interface IntentStatusResponse {
  readonly status: string;
  readonly completion_pct: number;
  readonly modes_executed: Record<string, string>;
}

interface IntentMapState {
  intents: readonly IntentNode[];
  expandedSlug: string | null;
  expandedExecutionId: string | null;
  events: Record<string, readonly ExecutionEvent[]>;
  loading: boolean;
  error: string | null;

  fetchIntents: () => Promise<void>;
  toggleExpanded: (slug: string) => void;
  fetchEvents: (executionId: string) => Promise<void>;
  toggleExecutionEvents: (executionId: string) => void;
}

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  researched: 1,
  outlined: 2,
  completed: 3,
  blocked: 4,
  idle: 5,
};

export const useIntentMapStore = create<IntentMapState>((set, get) => ({
  intents: [],
  expandedSlug: null,
  expandedExecutionId: null,
  events: {},
  loading: false,
  error: null,

  async fetchIntents() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ executions: Execution[] }>("/executions");
      const executions = data.executions.filter((e) => e.intent_slug);

      // Group by intent_slug
      const grouped = new Map<string, Execution[]>();
      for (const exec of executions) {
        const slug = exec.intent_slug as string;
        const list = grouped.get(slug) ?? [];
        list.push(exec);
        grouped.set(slug, list);
      }

      // Fetch status for each unique intent
      const intents: IntentNode[] = [];
      const entries = Array.from(grouped.entries());

      await Promise.all(
        entries.map(async ([slug, execs]) => {
          const projectSlug = execs[0]?.project_slug ?? "ema";
          let status = "idle";
          let completionPct = 0;
          let modesExecuted: Record<string, string> = {};

          try {
            const statusData = await api.get<IntentStatusResponse>(
              `/intents/${projectSlug}/${slug}/status`,
            );
            status = statusData.status;
            completionPct = statusData.completion_pct;
            modesExecuted = statusData.modes_executed;
          } catch {
            // Derive status from executions if endpoint fails
            const hasRunning = execs.some((e) => e.status === "running" || e.status === "approved");
            const hasCompleted = execs.some((e) => e.status === "completed");
            const hasFailed = execs.some((e) => e.status === "failed");
            if (hasRunning) status = "in_progress";
            else if (hasFailed) status = "blocked";
            else if (hasCompleted) status = "completed";
          }

          const sorted = [...execs].sort(
            (a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime(),
          );

          intents.push({
            intent_slug: slug,
            project_slug: execs[0]?.project_slug ?? null,
            status,
            completion_pct: completionPct,
            modes_executed: modesExecuted,
            latest_execution_id: sorted[0]?.id ?? null,
            executions: sorted,
          });
        }),
      );

      // Sort by status order
      intents.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));

      set({ intents, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  toggleExpanded(slug) {
    set((state) => ({
      expandedSlug: state.expandedSlug === slug ? null : slug,
      expandedExecutionId: null,
    }));
  },

  async fetchEvents(executionId) {
    try {
      const data = await api.get<{ events: ExecutionEvent[] }>(
        `/executions/${executionId}/events`,
      );
      set((state) => ({
        events: { ...state.events, [executionId]: data.events },
      }));
    } catch {
      // silently fail
    }
  },

  toggleExecutionEvents(executionId) {
    const { expandedExecutionId, events, fetchEvents } = get();
    if (expandedExecutionId === executionId) {
      set({ expandedExecutionId: null });
    } else {
      set({ expandedExecutionId: executionId });
      if (!events[executionId]) {
        fetchEvents(executionId);
      }
    }
  },
}));
