import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Canvas, CanvasElement } from "@/types/canvas";

interface CanvasState {
  canvases: readonly Canvas[];
  selectedCanvasId: string | null;
  elements: readonly CanvasElement[];
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  createCanvas: (data: {
    name: string;
    description?: string;
    canvas_type: string;
    project_id?: string | null;
  }) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  selectCanvas: (id: string) => Promise<void>;
  addElement: (canvasId: string, data: Partial<CanvasElement>) => Promise<void>;
  updateElement: (canvasId: string, elementId: string, data: Partial<CanvasElement>) => Promise<void>;
  removeElement: (canvasId: string, elementId: string) => Promise<void>;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  canvases: [],
  selectedCanvasId: null,
  elements: [],
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ canvases: Canvas[] }>("/canvases");
    set({ canvases: data.canvases });
  },

  async connect() {
    const { channel, response } = await joinChannel("canvas:lobby");
    const data = response as { canvases: Canvas[] };
    set({ channel, connected: true, canvases: data.canvases });

    channel.on("canvas_created", (canvas: Canvas) => {
      set((state) => ({ canvases: [canvas, ...state.canvases] }));
    });

    channel.on("canvas_deleted", (payload: { id: string }) => {
      set((state) => ({
        canvases: state.canvases.filter((c) => c.id !== payload.id),
      }));
    });
  },

  async createCanvas(data) {
    await api.post("/canvases", data);
  },

  async deleteCanvas(id) {
    await api.delete(`/canvases/${id}`);
  },

  async selectCanvas(id) {
    const data = await api.get<{ canvas: Canvas; elements: CanvasElement[] }>(
      `/canvases/${id}`
    );
    set({ selectedCanvasId: id, elements: data.elements });
  },

  async addElement(canvasId, data) {
    await api.post(`/canvases/${canvasId}/elements`, data);
    // Reload elements after adding
    const resp = await api.get<{ canvas: Canvas; elements: CanvasElement[] }>(
      `/canvases/${canvasId}`
    );
    set({ elements: resp.elements });
  },

  async updateElement(canvasId, elementId, data) {
    await api.patch(`/canvases/${canvasId}/elements/${elementId}`, data);
  },

  async removeElement(canvasId, elementId) {
    await api.delete(`/canvases/${canvasId}/elements/${elementId}`);
    set((state) => ({
      elements: state.elements.filter((e) => e.id !== elementId),
    }));
  },
}));
