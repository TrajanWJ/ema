import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Canvas, CanvasElement, CanvasTemplate } from "@/types/canvas";

interface CanvasState {
  canvases: readonly Canvas[];
  selectedCanvasId: string | null;
  elements: readonly CanvasElement[];
  templates: readonly CanvasTemplate[];
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  createCanvas: (data: {
    name: string;
    description?: string;
    canvas_type: string;
    project_id?: string | null;
  }) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  selectCanvas: (id: string) => Promise<void>;
  leaveCanvas: () => void;
  connect: () => Promise<void>;
  addElement: (data: Partial<CanvasElement>) => Promise<void>;
  updateElement: (elementId: string, data: Partial<CanvasElement>) => Promise<void>;
  removeElement: (elementId: string) => Promise<void>;
  instantiateTemplate: (templateId: string, name?: string, projectId?: string) => Promise<void>;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvases: [],
  selectedCanvasId: null,
  elements: [],
  templates: [],
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ canvases: Canvas[] }>("/canvases");
    set({ canvases: data.canvases });
  },

  async loadTemplates() {
    const data = await api.get<{ templates: CanvasTemplate[] }>("/canvas/templates");
    set({ templates: data.templates });
  },

  async createCanvas(data) {
    await api.post("/canvases", data);
    const resp = await api.get<{ canvases: Canvas[] }>("/canvases");
    set({ canvases: resp.canvases });
  },

  async deleteCanvas(id) {
    await api.delete(`/canvases/${id}`);
    set((state) => ({
      canvases: state.canvases.filter((c) => c.id !== id),
    }));
  },

  async selectCanvas(id) {
    const existing = get().channel;
    if (existing) {
      existing.leave();
    }

    const { channel } = await joinChannel(`canvas:${id}`);
    set({ selectedCanvasId: id, channel, connected: true, elements: [] });

    channel.on("snapshot", (payload: { elements: CanvasElement[] }) => {
      set({ elements: payload.elements });
    });

    channel.on("element:created", (element: CanvasElement) => {
      set((state) => ({ elements: [...state.elements, element] }));
    });

    channel.on("element:updated", (updated: CanvasElement) => {
      set((state) => ({
        elements: state.elements.map((e) => (e.id === updated.id ? updated : e)),
      }));
    });

    channel.on("element:deleted", (payload: { id: string }) => {
      set((state) => ({
        elements: state.elements.filter((e) => e.id !== payload.id),
      }));
    });

    channel.on("elements:reordered", (payload: { element_ids: string[] }) => {
      set((state) => {
        const byId = new Map(state.elements.map((e) => [e.id, e]));
        const reordered = payload.element_ids
          .map((eid, idx) => {
            const el = byId.get(eid);
            return el ? { ...el, z_index: idx } : null;
          })
          .filter((e): e is CanvasElement => e !== null);
        return { elements: reordered };
      });
    });

    // Live data updates from server for data-bound elements
    channel.on("element:data_updated", (payload: { element_id: string; data: unknown }) => {
      set((state) => ({
        elements: state.elements.map((e) =>
          e.id === payload.element_id ? { ...e, live_data: payload.data } : e
        ),
      }));
    });
  },

  leaveCanvas() {
    const ch = get().channel;
    if (ch) ch.leave();
    set({ selectedCanvasId: null, elements: [], channel: null, connected: false });
  },

  async connect() {
    // Canvas uses per-canvas channels via selectCanvas(), no global channel needed
  },

  async addElement(data) {
    const ch = get().channel;
    if (!ch) return;
    ch.push("element:create", data);
  },

  async updateElement(elementId, data) {
    const ch = get().channel;
    if (!ch) return;
    ch.push("element:update", { id: elementId, ...data });
  },

  async removeElement(elementId) {
    const ch = get().channel;
    if (!ch) return;
    ch.push("element:delete", { id: elementId });
  },

  async instantiateTemplate(templateId, name, projectId) {
    const resp = await api.post<Canvas>(`/canvas/${templateId}/instantiate-template`, {
      name,
      project_id: projectId,
    });
    // Reload and select the new canvas
    await get().loadViaRest();
    if (resp && "id" in resp) {
      await get().selectCanvas((resp as Canvas).id);
    }
  },
}));
