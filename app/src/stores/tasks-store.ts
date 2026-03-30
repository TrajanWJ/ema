import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Task, TaskComment } from "@/types/tasks";

interface TasksState {
  tasks: readonly Task[];
  connected: boolean;
  channel: Channel | null;
  loadViaRest: (projectId?: string) => Promise<void>;
  connect: (projectId?: string) => Promise<void>;
  createTask: (data: Partial<Task>) => Promise<void>;
  transitionTask: (id: string, status: Task["status"]) => Promise<void>;
  addComment: (id: string, body: string) => Promise<TaskComment>;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasks: [],
  connected: false,
  channel: null,

  async loadViaRest(projectId) {
    const path = projectId ? `/projects/${projectId}/tasks` : "/tasks";
    const data = await api.get<{ tasks: Task[] }>(path);
    set({ tasks: data.tasks });
  },

  async connect(projectId) {
    const topic = projectId ? `tasks:${projectId}` : "tasks:lobby";
    const { channel, response } = await joinChannel(topic);
    const data = response as { tasks: Task[] };
    set({ channel, connected: true, tasks: data.tasks });

    channel.on("task_created", (task: Task) => {
      set((state) => ({ tasks: [task, ...state.tasks] }));
    });

    channel.on("task_updated", (updated: Task) => {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === updated.id ? updated : t)),
      }));
    });

    channel.on("task_deleted", (payload: { id: string }) => {
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== payload.id),
      }));
    });
  },

  async createTask(data) {
    await api.post("/tasks", data);
  },

  async transitionTask(id, status) {
    await api.post(`/tasks/${id}/transition`, { status });
  },

  async addComment(id, body) {
    return api.post<TaskComment>(`/tasks/${id}/comments`, { body });
  },
}));
