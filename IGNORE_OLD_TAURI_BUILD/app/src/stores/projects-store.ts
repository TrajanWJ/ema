import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Project } from "@/types/projects";

interface ProjectsState {
  projects: readonly Project[];
  activeProject: Project | null;
  loaded: boolean;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  createProject: (data: Partial<Project>) => Promise<void>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  getProject: (id: string) => Promise<Project>;
  setActiveProject: (project: Project | null) => void;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  activeProject: null,
  loaded: false,
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ projects: Project[] }>("/projects");
    set({ projects: data.projects, loaded: true });
  },

  async connect() {
    const { channel, response } = await joinChannel("projects:lobby");
    const data = response as { projects: Project[] };
    set({ channel, connected: true, projects: data.projects });

    channel.on("project_created", (project: Project) => {
      set((state) => ({ projects: [project, ...state.projects] }));
    });

    channel.on("project_updated", (updated: Project) => {
      set((state) => ({
        projects: state.projects.map((p) => (p.id === updated.id ? updated : p)),
        activeProject:
          state.activeProject?.id === updated.id ? updated : state.activeProject,
      }));
    });

    channel.on("project_deleted", (payload: { id: string }) => {
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== payload.id),
        activeProject:
          state.activeProject?.id === payload.id ? null : state.activeProject,
      }));
    });
  },

  async createProject(data) {
    await api.post("/projects", data);
  },

  async updateProject(id, data) {
    await api.put(`/projects/${id}`, data);
  },

  async getProject(id) {
    return api.get<Project>(`/projects/${id}`);
  },

  setActiveProject(project) {
    set({ activeProject: project });
  },
}));
