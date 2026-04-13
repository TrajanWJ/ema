import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface SupermanGap {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly affectedFiles: readonly string[];
  readonly category: string;
}

interface FlowStep {
  readonly name: string;
  readonly status: string;
}

interface SupermanFlow {
  readonly name: string;
  readonly entryPoint: string;
  readonly steps: readonly FlowStep[];
  readonly completeness: number;
}

interface HealthStatus {
  readonly status: string;
  readonly mcp_connected: boolean;
  readonly indexed_repos: number;
}

interface ServerStatus {
  readonly indexing: boolean;
  readonly repos: readonly string[];
  readonly last_indexed_at: string | null;
}

interface CodeHealthState {
  health: HealthStatus | null;
  serverStatus: ServerStatus | null;
  gaps: readonly SupermanGap[];
  flows: readonly SupermanFlow[];
  panels: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  loadGaps: () => Promise<void>;
  loadFlows: () => Promise<void>;
  loadPanels: () => Promise<void>;
}

export type { SupermanGap, SupermanFlow, HealthStatus, ServerStatus };

export const useCodeHealthStore = create<CodeHealthState>((set, get) => ({
  health: null,
  serverStatus: null,
  gaps: [],
  flows: [],
  panels: null,
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const [health, status, gapsRes, flowsRes, panels] = await Promise.all([
        api.get<HealthStatus>("/superman/health"),
        api.get<ServerStatus>("/superman/status"),
        api.get<{ gaps: SupermanGap[] }>("/superman/gaps"),
        api.get<{ flows: SupermanFlow[] }>("/superman/flows"),
        api.get<Record<string, unknown>>("/superman/panels"),
      ]);
      set({
        health,
        serverStatus: status,
        gaps: gapsRes.gaps ?? [],
        flows: flowsRes.flows ?? [],
        panels,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async connect() {
    try {
      const { channel } = await joinChannel("superman:lobby");
      set({ channel, connected: true });

      channel.on("health", (payload: HealthStatus) => {
        set({ health: payload });
      });

      channel.on("gaps_updated", () => {
        get().loadGaps();
      });

      channel.on("flows_updated", () => {
        get().loadFlows();
      });
    } catch (e) {
      console.warn("Channel join failed:", e);
    }
  },

  async loadGaps() {
    try {
      const data = await api.get<{ gaps: SupermanGap[] }>("/superman/gaps");
      set({ gaps: data.gaps ?? [] });
    } catch {
      // silent
    }
  },

  async loadFlows() {
    try {
      const data = await api.get<{ flows: SupermanFlow[] }>("/superman/flows");
      set({ flows: data.flows ?? [] });
    } catch {
      // silent
    }
  },

  async loadPanels() {
    try {
      const panels = await api.get<Record<string, unknown>>(
        "/superman/panels",
      );
      set({ panels });
    } catch {
      // silent
    }
  },
}));
