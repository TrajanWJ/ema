import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

interface ProjectTaskSummary {
  readonly id?: string;
  readonly title?: string;
  readonly status?: string;
  readonly priority?: number | string | null;
  readonly agent?: string | null;
  readonly due_date?: string | null;
  readonly updated_at?: string | null;
  readonly created_at?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectProposalSummary {
  readonly id?: string;
  readonly title?: string;
  readonly status?: string;
  readonly summary?: string | null;
  readonly confidence?: number | null;
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectCampaignSummary {
  readonly id?: string;
  readonly name?: string | null;
  readonly title?: string | null;
  readonly status?: string | null;
  readonly summary?: string | null;
  readonly objective?: string | null;
  readonly channel?: string | null;
  readonly [key: string]: unknown;
}

interface ProjectExecutionSummary {
  readonly id?: string;
  readonly title?: string;
  readonly status?: string;
  readonly mode?: string | null;
  readonly result_path?: string | null;
  readonly completed_at?: string | null;
  readonly updated_at?: string | null;
  readonly inserted_at?: string | null;
  readonly [key: string]: unknown;
}

export interface ProjectContext {
  readonly active_tasks: readonly ProjectTaskSummary[];
  readonly recent_proposals: readonly ProjectProposalSummary[];
  readonly active_campaign: ProjectCampaignSummary | null;
  readonly last_execution: ProjectExecutionSummary | null;
  readonly [key: string]: unknown;
}

interface ProjectChannelPayload {
  readonly context?: ProjectContext;
  readonly project?: Partial<ProjectContext>;
  readonly task?: ProjectTaskSummary;
  readonly execution?: ProjectExecutionSummary;
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
  setCurrentProject: (slug: string | null) => void;
  loadProjectContext: (slug: string) => Promise<void>;
  connectProjectChannel: (slug: string) => Promise<void>;
  disconnectProjectChannel: () => void;
}

const EMPTY_CONTEXT: ProjectContext = {
  active_tasks: [],
  recent_proposals: [],
  active_campaign: null,
  last_execution: null,
};

function normalizeContext(input: unknown): ProjectContext {
  const data = (input ?? {}) as Partial<ProjectContext>;
  return {
    ...data,
    active_tasks: Array.isArray(data.active_tasks) ? data.active_tasks : [],
    recent_proposals: Array.isArray(data.recent_proposals) ? data.recent_proposals : [],
    active_campaign: data.active_campaign ?? null,
    last_execution: data.last_execution ?? null,
  };
}

function mergeContextPatch(current: ProjectContext | null, payload: ProjectChannelPayload): ProjectContext | null {
  if (payload.context) {
    return normalizeContext(payload.context);
  }

  if (payload.project) {
    return normalizeContext({ ...(current ?? EMPTY_CONTEXT), ...payload.project });
  }

  if (!current) {
    return null;
  }

  if (payload.task) {
    const nextTasks = [
      payload.task,
      ...current.active_tasks.filter((task) => task.id !== payload.task?.id),
    ];
    return normalizeContext({ ...current, active_tasks: nextTasks });
  }

  if (payload.execution) {
    return normalizeContext({ ...current, last_execution: payload.execution });
  }

  return current;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  context: null,
  loadingContext: false,
  contextError: null,
  connected: false,
  channel: null,
  channelTopic: null,

  setCurrentProject(slug) {
    set((state) => {
      if (state.currentProject === slug) return state;
      return {
        currentProject: slug,
        context: slug ? state.context : null,
        contextError: null,
      };
    });
  },

  async loadProjectContext(slug) {
    set({ loadingContext: true, contextError: null });
    try {
      const data = await api.get<ProjectContext | { context: ProjectContext }>(`/projects/${slug}/context`);
      if (get().currentProject !== slug) return;
      const context = normalizeContext("context" in data ? data.context : data);
      set({ context, loadingContext: false });
    } catch (err) {
      if (get().currentProject !== slug) return;
      set({
        context: null,
        loadingContext: false,
        contextError: err instanceof Error ? err.message : "Failed to load project context",
      });
    }
  },

  async connectProjectChannel(slug) {
    const topic = `projects:${slug}`;
    const existing = get().channel;
    if (existing && get().channelTopic === topic) {
      return;
    }

    existing?.leave();
    set({ channel: null, channelTopic: null, connected: false });

    const { channel } = await joinChannel(topic);
    if (get().currentProject !== slug) {
      channel.leave();
      return;
    }

    const refresh = () => {
      if (get().currentProject === slug) {
        void get().loadProjectContext(slug);
      }
    };

    set({ channel, channelTopic: topic, connected: true });

    channel.on("project_updated", (payload: ProjectChannelPayload) => {
      const next = mergeContextPatch(get().context, payload);
      if (next) {
        set({ context: next });
      } else {
        refresh();
      }
    });

    channel.on("task_created", (payload: ProjectChannelPayload) => {
      const next = mergeContextPatch(get().context, payload);
      if (next) {
        set({ context: next });
      } else {
        refresh();
      }
    });

    channel.on("execution_done", (payload: ProjectChannelPayload) => {
      const next = mergeContextPatch(get().context, payload);
      if (next) {
        set({ context: next });
      } else {
        refresh();
      }
    });
  },

  disconnectProjectChannel() {
    get().channel?.leave();
    set({ channel: null, channelTopic: null, connected: false });
  },
}));
