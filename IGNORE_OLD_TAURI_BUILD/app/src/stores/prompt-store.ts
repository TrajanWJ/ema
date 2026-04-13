import { create } from "zustand";
import { api } from "@/lib/api";

interface PromptTemplate {
  id: number;
  name: string;
  category: "system" | "agent" | "task" | "custom";
  body: string;
  variables: readonly string[];
  version: number;
  parent_id: number | null;
  inserted_at: string;
}

interface PromptState {
  templates: readonly PromptTemplate[];
  selected: PromptTemplate | null;
  loading: boolean;
  testResult: string | null;
  testing: boolean;

  loadTemplates: () => Promise<void>;
  selectTemplate: (t: PromptTemplate | null) => void;
  createTemplate: (attrs: Record<string, unknown>) => Promise<void>;
  updateTemplate: (id: number, attrs: Record<string, unknown>) => Promise<void>;
  deleteTemplate: (id: number) => Promise<void>;
  testPrompt: (body: string) => Promise<void>;
}

export type { PromptTemplate };

export const usePromptStore = create<PromptState>((set, get) => ({
  templates: [],
  selected: null,
  loading: false,
  testResult: null,
  testing: false,

  async loadTemplates() {
    set({ loading: true });
    try {
      const res = await api.get<{ data: PromptTemplate[] }>("/prompts");
      set({ templates: res.data ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectTemplate(t) {
    set({ selected: t, testResult: null });
  },

  async createTemplate(attrs) {
    try {
      await api.post("/prompts", { prompt_template: attrs });
      get().loadTemplates();
    } catch {
      /* swallow */
    }
  },

  async updateTemplate(id, attrs) {
    try {
      await api.put(`/prompts/${id}`, { prompt_template: attrs });
      get().loadTemplates();
    } catch {
      /* swallow */
    }
  },

  async deleteTemplate(id) {
    try {
      await api.delete(`/prompts/${id}`);
      set({ selected: null });
      get().loadTemplates();
    } catch {
      /* swallow */
    }
  },

  async testPrompt(body) {
    set({ testing: true, testResult: null });
    try {
      const res = await api.post<{ reply: string }>("/voice/process", {
        text: body,
      });
      set({ testResult: res.reply, testing: false });
    } catch {
      set({ testResult: "Error: could not reach AI", testing: false });
    }
  },
}));
