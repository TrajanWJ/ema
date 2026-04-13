import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { InboxItem } from "@/types/brain-dump";
import type { Execution } from "@/types/executions";

interface BrainDumpState {
  items: readonly InboxItem[];
  itemExecutions: Record<string, Execution>;
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  add: (content: string, source?: InboxItem["source"], projectId?: string | null) => Promise<void>;
  process: (id: string, action: InboxItem["action"]) => Promise<void>;
  promoteToTask: (id: string, title?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  loadExecutions: () => Promise<void>;
  approveExecution: (id: string) => Promise<void>;
  queueExecution: (itemId: string, content: string) => Promise<void>;
}

function buildExecutionMap(executions: readonly Execution[]): Record<string, Execution> {
  const map: Record<string, Execution> = {};
  for (const ex of executions) {
    if (ex.brain_dump_item_id) {
      map[ex.brain_dump_item_id] = ex;
    }
  }
  return map;
}

export const useBrainDumpStore = create<BrainDumpState>((set) => ({
  items: [],
  itemExecutions: {},
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    const [itemsData, execData] = await Promise.all([
      api.get<{ items: InboxItem[] }>("/brain-dump/items"),
      api.get<{ executions: Execution[] }>("/executions").catch(() => ({ executions: [] })),
    ]);
    set({
      items: itemsData.items,
      itemExecutions: buildExecutionMap(execData.executions),
    });
  },

  async connect() {
    const { channel, response } = await joinChannel("brain_dump:queue");
    const data = response as { items: InboxItem[] };
    set({ channel, connected: true, items: data.items });

    channel.on("item_created", (item: InboxItem) => {
      set((state) => ({ items: [item, ...state.items] }));
    });

    channel.on("item_processed", (updated: InboxItem) => {
      set((state) => ({
        items: state.items.map((item) => (item.id === updated.id ? updated : item)),
      }));
    });

    channel.on("item_deleted", (payload: { id: string }) => {
      set((state) => ({
        items: state.items.filter((item) => item.id !== payload.id),
      }));
    });
  },

  async add(content, source = "text", projectId = null) {
    await api.post("/brain-dump/items", { content, source, project_id: projectId });
  },

  async process(id, action) {
    await api.patch(`/brain-dump/items/${id}/process`, { action });
  },

  async promoteToTask(id, title) {
    await api.post(`/brain-dump/items/${id}/task`, title ? { title } : {});
  },

  async remove(id) {
    await api.delete(`/brain-dump/items/${id}`);
  },

  async loadExecutions() {
    const data = await api.get<{ executions: Execution[] }>("/executions").catch(() => ({ executions: [] }));
    set({ itemExecutions: buildExecutionMap(data.executions) });
  },

  async approveExecution(id) {
    await api.post(`/executions/${id}/approve`, {});
    await useBrainDumpStore.getState().loadExecutions();
  },

  async queueExecution(itemId, content) {
    const result = await api.post<{ execution: Execution }>("/executions", {
      title: content.slice(0, 100),
      mode: "research",
      brain_dump_item_id: itemId,
      requires_approval: true,
    });
    set((s) => ({
      itemExecutions: { ...s.itemExecutions, [itemId]: result.execution },
    }));
  },
}));
