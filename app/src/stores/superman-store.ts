import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

export interface SupermanGap {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly affectedFiles: readonly string[];
  readonly category: string;
}

export interface SupermanFlow {
  readonly name: string;
  readonly entryPoint: string;
  readonly steps: readonly { readonly name: string; readonly status: string }[];
  readonly completeness: number;
}

export interface IntentNode {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly children?: readonly IntentNode[];
  readonly description?: string;
}

export interface QueryHistoryEntry {
  readonly query: string;
  readonly answer: string;
  readonly timestamp: string;
}

interface SupermanState {
  connected: boolean;
  channel: Channel | null;
  serverStatus: "connected" | "disconnected" | "checking";

  // Index state
  indexing: boolean;
  projectInfo: Record<string, unknown> | null;

  // Query
  querying: boolean;
  lastAnswer: Record<string, unknown> | null;
  queryHistory: readonly QueryHistoryEntry[];

  // Gaps
  gaps: Record<string, unknown> | null;
  loadingGaps: boolean;

  // Flows
  flows: readonly SupermanFlow[];
  loadingFlows: boolean;

  // Intent graph
  intentGraph: Record<string, unknown> | null;
  loadingIntent: boolean;

  // Panels
  panels: Record<string, unknown> | null;

  // Autonomous
  autonomousRunning: boolean;
  autonomousResult: Record<string, unknown> | null;

  // Actions
  checkHealth: () => Promise<void>;
  connect: () => Promise<void>;
  indexProject: (projectId: string) => Promise<void>;
  indexPath: (repoPath: string) => Promise<void>;
  askCodebase: (query: string) => Promise<void>;
  loadGaps: () => Promise<void>;
  loadFlows: () => Promise<void>;
  loadIntentGraph: () => Promise<void>;
  loadPanels: () => Promise<void>;
  applyChange: (instruction: string) => Promise<void>;
  simulateFlow: (entryPoint?: string) => Promise<void>;
  runAutonomous: () => Promise<void>;
  buildTask: (task: string) => Promise<void>;
  addQueryHistory: (entry: QueryHistoryEntry) => void;
}

export const useSupermanStore = create<SupermanState>((set, get) => ({
  connected: false,
  channel: null,
  serverStatus: "checking",

  indexing: false,
  projectInfo: null,

  querying: false,
  lastAnswer: null,
  queryHistory: loadQueryHistory(),

  gaps: null,
  loadingGaps: false,

  flows: [],
  loadingFlows: false,

  intentGraph: null,
  loadingIntent: false,

  panels: null,

  autonomousRunning: false,
  autonomousResult: null,

  async checkHealth() {
    set({ serverStatus: "checking" });
    try {
      const data = await api.get<{ status: string }>("/superman/health");
      set({ serverStatus: data.status === "connected" ? "connected" : "disconnected" });
    } catch {
      set({ serverStatus: "disconnected" });
    }
  },

  async connect() {
    try {
      const { channel } = await joinChannel("superman:lobby");
      set({ channel, connected: true });

      channel.on("health", (payload: { status: string }) => {
        set({ serverStatus: payload.status === "connected" ? "connected" : "disconnected" });
      });
    } catch {
      set({ connected: false });
    }
  },

  async indexProject(projectId: string) {
    set({ indexing: true });
    try {
      const data = await api.post<Record<string, unknown>>("/superman/index", {
        project_id: projectId,
      });
      set({ projectInfo: data, indexing: false });
    } catch {
      set({ indexing: false });
    }
  },

  async indexPath(repoPath: string) {
    set({ indexing: true });
    try {
      const data = await api.post<Record<string, unknown>>("/superman/index", {
        repo_path: repoPath,
      });
      set({ projectInfo: data, indexing: false });
    } catch {
      set({ indexing: false });
    }
  },

  async askCodebase(query: string) {
    set({ querying: true });
    try {
      const data = await api.post<Record<string, unknown>>("/superman/ask", { query });
      set({ lastAnswer: data, querying: false });
      const entry: QueryHistoryEntry = {
        query,
        answer: JSON.stringify(data),
        timestamp: new Date().toISOString(),
      };
      get().addQueryHistory(entry);
    } catch {
      set({ querying: false });
    }
  },

  async loadGaps() {
    set({ loadingGaps: true });
    try {
      const data = await api.get<Record<string, unknown>>("/superman/gaps");
      set({ gaps: data, loadingGaps: false });
    } catch {
      set({ loadingGaps: false });
    }
  },

  async loadFlows() {
    set({ loadingFlows: true });
    try {
      const data = await api.get<{ flows?: SupermanFlow[] }>("/superman/flows");
      set({ flows: data.flows ?? [], loadingFlows: false });
    } catch {
      set({ loadingFlows: false });
    }
  },

  async loadIntentGraph() {
    set({ loadingIntent: true });
    try {
      const data = await api.get<Record<string, unknown>>("/superman/intent");
      set({ intentGraph: data, loadingIntent: false });
    } catch {
      set({ loadingIntent: false });
    }
  },

  async loadPanels() {
    try {
      const data = await api.get<Record<string, unknown>>("/superman/panels");
      set({ panels: data });
    } catch {
      // ignore
    }
  },

  async applyChange(instruction: string) {
    await api.post("/superman/apply", { instruction });
  },

  async simulateFlow(entryPoint?: string) {
    const body = entryPoint ? { entry_point: entryPoint } : {};
    await api.post("/superman/simulate", body);
  },

  async runAutonomous() {
    set({ autonomousRunning: true, autonomousResult: null });
    try {
      const data = await api.post<Record<string, unknown>>("/superman/autonomous", {});
      set({ autonomousResult: data, autonomousRunning: false });
    } catch {
      set({ autonomousRunning: false });
    }
  },

  async buildTask(task: string) {
    await api.post("/superman/build", { task });
  },

  addQueryHistory(entry: QueryHistoryEntry) {
    set((state) => {
      const history = [entry, ...state.queryHistory].slice(0, 20);
      saveQueryHistory(history);
      return { queryHistory: history };
    });
  },
}));

function loadQueryHistory(): QueryHistoryEntry[] {
  try {
    const raw = localStorage.getItem("superman_query_history");
    return raw ? (JSON.parse(raw) as QueryHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveQueryHistory(history: readonly QueryHistoryEntry[]) {
  try {
    localStorage.setItem("superman_query_history", JSON.stringify(history));
  } catch {
    // ignore
  }
}
