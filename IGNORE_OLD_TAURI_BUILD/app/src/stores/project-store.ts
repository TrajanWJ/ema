import { create } from "zustand";
import type { Channel } from "phoenix";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";

interface ProjectSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly description?: string | null;
  readonly icon?: string | null;
  readonly color?: string | null;
  readonly linked_path?: string | null;
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
}

interface ProjectTaskSummary {
  readonly id?: string;
  readonly title?: string;
  readonly status?: string;
  readonly priority?: number | string | null;
  readonly updated_at?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectProposalSummary {
  readonly id?: string;
  readonly title?: string;
  readonly summary?: string | null;
  readonly status?: string;
  readonly confidence?: number | null;
  readonly updated_at?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectCampaignSummary {
  readonly id?: string;
  readonly name?: string | null;
  readonly status?: string | null;
  readonly flow_state?: string | null;
  readonly run_count?: number | null;
  readonly step_count?: number | null;
  readonly [key: string]: unknown;
}

interface ProjectExecutionSummary {
  readonly id?: string;
  readonly title?: string;
  readonly mode?: string | null;
  readonly status?: string;
  readonly result_summary?: string | null;
  readonly result_path?: string | null;
  readonly started_at?: string | null;
  readonly completed_at?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectGapSummary {
  readonly id?: string;
  readonly title?: string;
  readonly severity?: string;
  readonly gap_type?: string | null;
  readonly source?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectVaultNoteSummary {
  readonly id?: string;
  readonly title?: string;
  readonly file_path?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectReflexionSummary {
  readonly agent?: string | null;
  readonly domain?: string | null;
  readonly lesson?: string | null;
  readonly outcome_status?: string | null;
  readonly recorded_at?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectStats {
  readonly total_executions: number;
  readonly active_tasks: number;
  readonly total_campaigns: number;
  readonly total_proposals: number;
}

interface ProjectHealth {
  readonly status: string | null;
  readonly running_executions: number;
  readonly active_campaign: boolean;
  readonly open_gaps: number;
  readonly critical_gaps: number;
}

interface ProjectTaskCollection {
  readonly total: number;
  readonly by_status: Record<string, number>;
  readonly recent: readonly ProjectTaskSummary[];
}

interface ProjectProposalCollection {
  readonly total: number;
  readonly by_status: Record<string, number>;
  readonly recent: readonly ProjectProposalSummary[];
}

interface ProjectExecutionCollection {
  readonly total: number;
  readonly running: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly success_rate: number;
  readonly recent: readonly ProjectExecutionSummary[];
}

interface ProjectReflexionCollection {
  readonly total_lessons: number;
  readonly recent: readonly ProjectReflexionSummary[];
}

interface ProjectGapCollection {
  readonly total_open: number;
  readonly critical_count: number;
  readonly top_blockers: readonly ProjectGapSummary[];
}

interface ProjectVaultCollection {
  readonly note_count: number;
  readonly recent_notes: readonly ProjectVaultNoteSummary[];
}

export interface ProjectContext {
  readonly project: ProjectSummary | null;
  readonly tasks: ProjectTaskCollection;
  readonly proposals: ProjectProposalCollection;
  readonly campaigns: readonly ProjectCampaignSummary[];
  readonly active_campaign: ProjectCampaignSummary | null;
  readonly executions: ProjectExecutionCollection;
  readonly reflexion: ProjectReflexionCollection;
  readonly gaps: ProjectGapCollection;
  readonly health: ProjectHealth;
  readonly stats: ProjectStats;
  readonly vault: ProjectVaultCollection;
  readonly last_activity: string | null;
  readonly generated_at: string | null;
  readonly [key: string]: unknown;
}

interface ProjectState {
  currentProject: string | null;
  context: ProjectContext | null;
  loadingContext: boolean;
  contextError: string | null;
  connected: boolean;
  channel: Channel | null;
  channelTopic: string | null;
  setCurrentProject: (projectId: string | null) => void;
  loadProjectContext: (projectIdOrSlug: string) => Promise<void>;
  connectProjectChannel: (projectId: string) => Promise<void>;
  disconnectProjectChannel: () => void;
}

const EMPTY_CONTEXT: ProjectContext = {
  project: null,
  tasks: { total: 0, by_status: {}, recent: [] },
  proposals: { total: 0, by_status: {}, recent: [] },
  campaigns: [],
  active_campaign: null,
  executions: { total: 0, running: 0, succeeded: 0, failed: 0, success_rate: 0, recent: [] },
  reflexion: { total_lessons: 0, recent: [] },
  gaps: { total_open: 0, critical_count: 0, top_blockers: [] },
  health: { status: null, running_executions: 0, active_campaign: false, open_gaps: 0, critical_gaps: 0 },
  stats: { total_executions: 0, active_tasks: 0, total_campaigns: 0, total_proposals: 0 },
  vault: { note_count: 0, recent_notes: [] },
  last_activity: null,
  generated_at: null,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asStringRecord(value: unknown): Record<string, number> {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

function normalizeContext(input: unknown): ProjectContext {
  const data = asRecord(input);
  const tasks = asRecord(data.tasks);
  const proposals = asRecord(data.proposals);
  const executions = asRecord(data.executions);
  const reflexion = asRecord(data.reflexion);
  const gaps = asRecord(data.gaps);
  const health = asRecord(data.health);
  const stats = asRecord(data.stats);
  const vault = asRecord(data.vault);

  return {
    ...EMPTY_CONTEXT,
    ...data,
    project: data.project ? (data.project as ProjectSummary) : null,
    tasks: {
      total: typeof tasks.total === "number" ? tasks.total : 0,
      by_status: asStringRecord(tasks.by_status),
      recent: Array.isArray(tasks.recent) ? (tasks.recent as ProjectTaskSummary[]) : [],
    },
    proposals: {
      total: typeof proposals.total === "number" ? proposals.total : 0,
      by_status: asStringRecord(proposals.by_status),
      recent: Array.isArray(proposals.recent) ? (proposals.recent as ProjectProposalSummary[]) : [],
    },
    campaigns: Array.isArray(data.campaigns) ? (data.campaigns as ProjectCampaignSummary[]) : [],
    active_campaign: data.active_campaign ? (data.active_campaign as ProjectCampaignSummary) : null,
    executions: {
      total: typeof executions.total === "number" ? executions.total : 0,
      running: typeof executions.running === "number" ? executions.running : 0,
      succeeded: typeof executions.succeeded === "number" ? executions.succeeded : 0,
      failed: typeof executions.failed === "number" ? executions.failed : 0,
      success_rate: typeof executions.success_rate === "number" ? executions.success_rate : 0,
      recent: Array.isArray(executions.recent) ? (executions.recent as ProjectExecutionSummary[]) : [],
    },
    reflexion: {
      total_lessons: typeof reflexion.total_lessons === "number" ? reflexion.total_lessons : 0,
      recent: Array.isArray(reflexion.recent) ? (reflexion.recent as ProjectReflexionSummary[]) : [],
    },
    gaps: {
      total_open: typeof gaps.total_open === "number" ? gaps.total_open : 0,
      critical_count: typeof gaps.critical_count === "number" ? gaps.critical_count : 0,
      top_blockers: Array.isArray(gaps.top_blockers) ? (gaps.top_blockers as ProjectGapSummary[]) : [],
    },
    health: {
      status: typeof health.status === "string" ? health.status : null,
      running_executions: typeof health.running_executions === "number" ? health.running_executions : 0,
      active_campaign: health.active_campaign === true,
      open_gaps: typeof health.open_gaps === "number" ? health.open_gaps : 0,
      critical_gaps: typeof health.critical_gaps === "number" ? health.critical_gaps : 0,
    },
    stats: {
      total_executions: typeof stats.total_executions === "number" ? stats.total_executions : 0,
      active_tasks: typeof stats.active_tasks === "number" ? stats.active_tasks : 0,
      total_campaigns: typeof stats.total_campaigns === "number" ? stats.total_campaigns : 0,
      total_proposals: typeof stats.total_proposals === "number" ? stats.total_proposals : 0,
    },
    vault: {
      note_count: typeof vault.note_count === "number" ? vault.note_count : 0,
      recent_notes: Array.isArray(vault.recent_notes) ? (vault.recent_notes as ProjectVaultNoteSummary[]) : [],
    },
    last_activity: typeof data.last_activity === "string" ? data.last_activity : null,
    generated_at: typeof data.generated_at === "string" ? data.generated_at : null,
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  context: null,
  loadingContext: false,
  contextError: null,
  connected: false,
  channel: null,
  channelTopic: null,

  setCurrentProject(projectId) {
    set((state) => {
      if (state.currentProject === projectId) {
        return state;
      }

      return {
        currentProject: projectId,
        context: null,
        contextError: null,
      };
    });
  },

  async loadProjectContext(projectIdOrSlug) {
    set({ loadingContext: true, contextError: null });

    try {
      const data = await api.get<ProjectContext | { context: ProjectContext }>(`/projects/${projectIdOrSlug}/context`);
      if (get().currentProject !== projectIdOrSlug) {
        return;
      }

      const context = normalizeContext("context" in data ? data.context : data);
      set({ context, loadingContext: false });
    } catch (err) {
      if (get().currentProject !== projectIdOrSlug) {
        return;
      }

      set({
        context: null,
        loadingContext: false,
        contextError: err instanceof Error ? err.message : "Failed to load project context",
      });
    }
  },

  async connectProjectChannel(projectId) {
    const topic = `projects:${projectId}`;
    const existing = get().channel;

    if (existing && get().channelTopic === topic) {
      return;
    }

    existing?.leave();
    set({ channel: null, channelTopic: null, connected: false });

    try {
      const { channel } = await joinChannel(topic);
      if (get().currentProject !== projectId) {
        channel.leave();
        return;
      }

      const refresh = () => {
        if (get().currentProject === projectId) {
          void get().loadProjectContext(projectId);
        }
      };

      set({ channel, channelTopic: topic, connected: true });

      channel.on("project_updated", () => {
        refresh();
      });

      channel.on("task_created", () => {
        refresh();
      });

      channel.on("execution_done", () => {
        refresh();
      });

      channel.onError(() => {
        if (get().channelTopic === topic) {
          set({ connected: false });
        }
      });

      channel.onClose(() => {
        if (get().channelTopic === topic) {
          set({ channel: null, channelTopic: null, connected: false });
        }
      });
    } catch {
      if (get().currentProject === projectId) {
        set({ channel: null, channelTopic: null, connected: false });
      }
    }
  },

  disconnectProjectChannel() {
    get().channel?.leave();
    set({ channel: null, channelTopic: null, connected: false });
  },
}));
