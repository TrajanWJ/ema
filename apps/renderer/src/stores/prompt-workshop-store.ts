import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface PromptTemplate {
  readonly id: number;
  readonly name: string;
  readonly category: "system" | "agent" | "task" | "custom";
  readonly body: string;
  readonly variables: readonly string[];
  readonly version: number;
  readonly parent_id: number | null;
  readonly inserted_at: string;
}

interface PromptVersion {
  readonly id: number;
  readonly prompt_id: number;
  readonly version: number;
  readonly body: string;
  readonly changelog: string | null;
  readonly inserted_at: string;
}

interface PromptWorkshopState {
  templates: readonly PromptTemplate[];
  selected: PromptTemplate | null;
  versions: readonly PromptVersion[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  selectTemplate: (t: PromptTemplate | null) => void;
  createTemplate: (attrs: Record<string, unknown>) => Promise<void>;
  updateTemplate: (id: number, attrs: Record<string, unknown>) => Promise<void>;
  deleteTemplate: (id: number) => Promise<void>;
  createVersion: (id: number, attrs: Record<string, unknown>) => Promise<void>;
  loadVersions: (id: number) => Promise<void>;
}

export type { PromptTemplate, PromptVersion };

export const usePromptWorkshopStore = create<PromptWorkshopState>(
  (set, get) => ({
    templates: [],
    selected: null,
    versions: [],
    loading: false,
    error: null,
    connected: false,
    channel: null,

    async loadViaRest() {
      set({ loading: true, error: null });
      try {
        const res = await api.get<{ data: PromptTemplate[] }>("/prompts");
        set({ templates: res.data ?? [], loading: false });
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    async connect() {
      try {
        const { channel, response } = await joinChannel("prompts:lobby");
        const data = response as { data: PromptTemplate[] };
        if (data.data) {
          set({ templates: data.data });
        }
        set({ channel, connected: true });

        channel.on("prompt_created", (template: PromptTemplate) => {
          set((state) => ({
            templates: [template, ...state.templates],
          }));
        });

        channel.on("prompt_updated", (updated: PromptTemplate) => {
          set((state) => ({
            templates: state.templates.map((t) =>
              t.id === updated.id ? updated : t,
            ),
            selected:
              state.selected?.id === updated.id ? updated : state.selected,
          }));
        });

        channel.on("prompt_deleted", (payload: { id: number }) => {
          set((state) => ({
            templates: state.templates.filter((t) => t.id !== payload.id),
            selected:
              state.selected?.id === payload.id ? null : state.selected,
          }));
        });

        channel.on("version_created", () => {
          const sel = get().selected;
          if (sel) {
            get().loadVersions(sel.id);
          }
        });
      } catch (e) {
        console.warn("Channel join failed:", e);
      }
    },

    selectTemplate(t) {
      set({ selected: t, versions: [] });
      if (t) {
        get().loadVersions(t.id);
      }
    },

    async createTemplate(attrs) {
      await api.post("/prompts", { prompt_template: attrs });
    },

    async updateTemplate(id, attrs) {
      await api.put(`/prompts/${id}`, { prompt_template: attrs });
    },

    async deleteTemplate(id) {
      await api.delete(`/prompts/${id}`);
      set((state) => ({
        selected: state.selected?.id === id ? null : state.selected,
      }));
    },

    async createVersion(id, attrs) {
      await api.post(`/prompts/${id}/version`, attrs);
      get().loadVersions(id);
      get().loadViaRest();
    },

    async loadVersions(id) {
      try {
        const res = await api.get<{ versions: PromptVersion[] }>(
          `/prompts/${id}`,
        );
        set({ versions: res.versions ?? [] });
      } catch {
        // silent — versions may not be in show response
      }
    },
  }),
);
