import { create } from "zustand";
import { api } from "@/lib/api";

interface PipelineStats {
  seeds: number;
  proposals: Record<string, number>;
  tasks: Record<string, number>;
  active_sessions: number;
}

interface Bottleneck {
  id: string;
  title: string;
  stage: string;
  stuck_since: string;
}

interface ThroughputPoint {
  period: string;
  count: number;
}

interface PipelineState {
  stats: PipelineStats | null;
  bottlenecks: readonly Bottleneck[];
  throughput: readonly ThroughputPoint[];
  loading: boolean;

  loadStats: () => Promise<void>;
  loadBottlenecks: () => Promise<void>;
  loadThroughput: (period?: string) => Promise<void>;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  stats: null,
  bottlenecks: [],
  throughput: [],
  loading: false,

  async loadStats() {
    set({ loading: true });
    try {
      const stats = await api.get<PipelineStats>("/pipeline/stats");
      set({ stats, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async loadBottlenecks() {
    try {
      const res = await api.get<{ bottlenecks: Bottleneck[] }>("/pipeline/bottlenecks");
      set({ bottlenecks: res.bottlenecks });
    } catch {
      /* noop */
    }
  },

  async loadThroughput(period = "day") {
    try {
      const res = await api.get<{ throughput: ThroughputPoint[] }>(
        `/pipeline/throughput?period=${period}`,
      );
      set({ throughput: res.throughput });
    } catch {
      /* noop */
    }
  },
}));
