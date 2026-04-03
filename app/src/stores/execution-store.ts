import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Execution } from "@/types/executions";

interface ExecutionState {
  executions: readonly Execution[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  statusFilter: string | null;
  modeFilter: string | null;

  setStatusFilter: (s: string | null) => void;
  setModeFilter: (m: string | null) => void;

  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  complete: (id: string, resultSummary?: string) => Promise<void>;
  create: (data: Partial<Execution> & { title: string }) => Promise<Execution>;

  filteredExecutions: () => readonly Execution[];
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executions: [],
  loading: false,
  error: null,
  connected: false,
  channel: null,
  statusFilter: null,
  modeFilter: null,

  setStatusFilter(s) { set({ statusFilter: s }); },
  setModeFilter(m) { set({ modeFilter: m }); },

  filteredExecutions() {
    const { executions, statusFilter, modeFilter } = get();
    return executions.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (modeFilter && e.mode !== modeFilter) return false;
      return true;
    });
  },

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ executions: Execution[] }>("/executions");
      set({ executions: data.executions, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  async connect() {
    const { channel, response } = await joinChannel("executions:all");
    const data = response as { executions: Execution[] };
    set({ channel, connected: true, executions: data.executions });

    channel.on("execution_created", (execution: Execution) => {
      set((state) => ({ executions: [execution, ...state.executions] }));
    });

    channel.on("execution_updated", ({ execution }: { execution: Execution }) => {
      set((state) => ({
        executions: state.executions.map((e) => (e.id === execution.id ? execution : e)),
      }));
    });

    channel.on("execution_completed", ({ execution }: { execution: Execution }) => {
      set((state) => ({
        executions: state.executions.map((e) => (e.id === execution.id ? execution : e)),
      }));
    });
  },

  async approve(id) {
    const { channel } = get();
    if (channel) {
      channel.push("approve", { id });
    } else {
      await api.post(`/executions/${id}/approve`, {});
      await get().loadViaRest();
    }
  },

  async cancel(id) {
    const { channel } = get();
    if (channel) {
      channel.push("cancel", { id });
    } else {
      await api.post(`/executions/${id}/cancel`, {});
      await get().loadViaRest();
    }
  },

  async complete(id, resultSummary = "") {
    const { channel } = get();
    if (channel) {
      channel.push("complete", { id, result_summary: resultSummary });
    } else {
      await api.post(`/executions/${id}/complete`, { result_summary: resultSummary });
      await get().loadViaRest();
    }
  },

  async create(data) {
    const result = await api.post<{ execution: Execution }>("/executions", data);
    set((state) => ({ executions: [result.execution, ...state.executions] }));
    return result.execution;
  },
}));
