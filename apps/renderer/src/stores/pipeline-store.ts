import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface PipelineStats {
  readonly seeds: number;
  readonly proposals: Record<string, number>;
  readonly tasks: Record<string, number>;
  readonly active_sessions: number;
}

interface Bottleneck {
  readonly id: string;
  readonly title: string;
  readonly stage: string;
  readonly stuck_since: string;
}

interface ThroughputPoint {
  readonly period: string;
  readonly count: number;
}

interface PipelineState {
  stats: PipelineStats | null;
  bottlenecks: readonly Bottleneck[];
  throughput: readonly ThroughputPoint[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  loadStats: () => Promise<void>;
  connect: () => Promise<void>;
  loadBottlenecks: () => Promise<void>;
  loadThroughput: (period?: string) => Promise<void>;
}

export type { PipelineStats, Bottleneck, ThroughputPoint };

export const usePipelineStore = create<PipelineState>((set, get) => ({
  stats: null,
  bottlenecks: [],
  throughput: [],
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadStats(): Promise<void> {
    return usePipelineStore.getState().loadViaRest();
  },

  async loadViaRest(): Promise<void> {
    set({ loading: true, error: null });
    try {
      const [stats, bottlenecksRes, throughputRes] = await Promise.all([
        api.get<PipelineStats>("/pipeline/stats"),
        api.get<{ bottlenecks: Bottleneck[] }>("/pipeline/bottlenecks"),
        api.get<{ throughput: ThroughputPoint[] }>("/pipeline/throughput"),
      ]);
      set({
        stats,
        bottlenecks: bottlenecksRes.bottlenecks ?? [],
        throughput: throughputRes.throughput ?? [],
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async connect(): Promise<void> {
    try {
      const { channel } = await joinChannel("pipeline:lobby");
      set({ channel, connected: true });

      channel.on("stats_updated", (payload: PipelineStats) => {
        set({ stats: payload });
      });

      channel.on("bottleneck_detected", () => {
        get().loadBottlenecks();
      });

      channel.on("throughput_updated", () => {
        get().loadThroughput();
      });
    } catch (e) {
      console.warn("Channel join failed:", e);
    }
  },

  async loadBottlenecks(): Promise<void> {
    try {
      const res = await api.get<{ bottlenecks: Bottleneck[] }>(
        "/pipeline/bottlenecks",
      );
      set({ bottlenecks: res.bottlenecks ?? [] });
    } catch {
      // silent
    }
  },

  async loadThroughput(period = "day"): Promise<void> {
    try {
      const res = await api.get<{ throughput: ThroughputPoint[] }>(
        `/pipeline/throughput?period=${period}`,
      );
      set({ throughput: res.throughput ?? [] });
    } catch {
      // silent
    }
  },
}));
