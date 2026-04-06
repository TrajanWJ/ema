import { create } from "zustand";
import * as hq from "../api/hq";

export interface AgentEvent {
  taskId: string;
  type: string;
  content: string;
  timestamp: number;
  toolCall?: any;
}

export interface Execution {
  id: string;
  title: string;
  status: string;
  project_id?: string | null;
  project_name?: string | null;
  project_color?: string | null;
  agent_model?: string | null;
  summary?: string | null;
  started_at?: number | null;
  ended_at?: number | null;
  ms?: number | null;
  created_at?: number;
  events?: string;
  tool_calls?: string;
}

interface ExecutionStore {
  executions: Execution[];
  liveEvents: Record<string, AgentEvent[]>;
  loadExecutions(): Promise<void>;
  addExecution(execution: Execution): void;
  updateExecution(id: string, updates: Partial<Execution>): void;
  addEvent(taskId: string, event: AgentEvent): void;
  getRunning(): Execution[];
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  executions: [],
  liveEvents: {},
  async loadExecutions() {
    const executions = await hq.getExecutions();
    set({ executions });
  },
  addExecution(execution) {
    set((state) => ({
      executions: [execution, ...state.executions.filter((item) => item.id !== execution.id)]
    }));
  },
  updateExecution(id, updates) {
    set((state) => ({
      executions: state.executions.map((execution) =>
        execution.id === id ? { ...execution, ...updates } : execution
      )
    }));
  },
  addEvent(taskId, event) {
    set((state) => ({
      liveEvents: {
        ...state.liveEvents,
        [taskId]: [...(state.liveEvents[taskId] || []), event].slice(-100)
      }
    }));
  },
  getRunning() {
    return get().executions.filter((execution) => execution.status === "running");
  }
}));
