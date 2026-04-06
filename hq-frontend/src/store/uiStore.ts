import { create } from "zustand";

export type PageName = "dashboard" | "projects" | "executions" | "agents" | "braindump";

export interface FloatingWindowState {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

interface UIStore {
  sidebarOpen: boolean;
  activePage: PageName;
  floatingWindows: FloatingWindowState[];
  projectSwitcherOpen: boolean;
  topZ: number;
  toggleSidebar(): void;
  setPage(page: PageName): void;
  openFloat(type: string, title: string): void;
  closeFloat(id: string): void;
  bringToFront(id: string): void;
  moveFloat(id: string, x: number, y: number): void;
  toggleProjectSwitcher(): void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarOpen: true,
  activePage: "dashboard",
  floatingWindows: [],
  projectSwitcherOpen: false,
  topZ: 300,
  toggleSidebar() {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },
  setPage(page) {
    set({ activePage: page });
  },
  openFloat(type, title) {
    const id = `${type}-${Date.now()}`;
    const z = get().topZ + 1;
    set((state) => ({
      topZ: z,
      floatingWindows: [
        ...state.floatingWindows,
        { id, type, title, x: 220 + state.floatingWindows.length * 20, y: 90 + state.floatingWindows.length * 20, w: 520, h: 360, z }
      ]
    }));
  },
  closeFloat(id) {
    set((state) => ({ floatingWindows: state.floatingWindows.filter((window) => window.id !== id) }));
  },
  bringToFront(id) {
    const z = get().topZ + 1;
    set((state) => ({
      topZ: z,
      floatingWindows: state.floatingWindows.map((window) => (window.id === id ? { ...window, z } : window))
    }));
  },
  moveFloat(id, x, y) {
    set((state) => ({
      floatingWindows: state.floatingWindows.map((window) => (window.id === id ? { ...window, x, y } : window))
    }));
  },
  toggleProjectSwitcher() {
    set((state) => ({ projectSwitcherOpen: !state.projectSwitcherOpen }));
  }
}));
