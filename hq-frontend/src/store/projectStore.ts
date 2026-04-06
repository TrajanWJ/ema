import { create } from "zustand";
import * as hq from "../api/hq";

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  color?: string;
  path?: string | null;
  superman_url?: string | null;
  running_count?: number;
  total_executions?: number;
  last_execution?: number | null;
}

export interface ProjectContext {
  project: Project;
  resources: any[];
  executions: any[];
  notes: any[];
  brainDump: any[];
  superman: any;
  stats: Record<string, number>;
}

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  activeProjectContext: ProjectContext | null;
  loading: boolean;
  contextLoading: boolean;
  error: string | null;
  loadProjects(): Promise<void>;
  setActiveProject(id: string): Promise<void>;
  createProject(data: Partial<Project>): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<void>;
  refreshContext(): Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeProjectContext: null,
  loading: false,
  contextLoading: false,
  error: null,
  async loadProjects() {
    set({ loading: true, error: null });
    try {
      const projects = await hq.getProjects();
      set({ projects, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
  async setActiveProject(id) {
    set({ activeProjectId: id, contextLoading: true, error: null });
    try {
      const context = await hq.getProjectContext(id);
      set({ activeProjectContext: context, contextLoading: false });
    } catch (error) {
      set({ contextLoading: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
  async createProject(data) {
    const project = await hq.createProject(data);
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },
  async updateProject(id, data) {
    const updated = await hq.updateProject(id, data);
    set((state) => ({
      projects: state.projects.map((project) => (project.id === id ? updated : project)),
      activeProjectContext:
        state.activeProjectContext?.project.id === id
          ? { ...state.activeProjectContext, project: updated }
          : state.activeProjectContext
    }));
  },
  async refreshContext() {
    const id = get().activeProjectId;
    if (!id) return;
    set({ contextLoading: true });
    try {
      const context = await hq.getProjectContext(id);
      set({ activeProjectContext: context, contextLoading: false });
    } catch (error) {
      set({ contextLoading: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
}));
