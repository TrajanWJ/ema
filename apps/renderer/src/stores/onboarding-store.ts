import { create } from "zustand";
import { api } from "@/lib/api";

export interface OnboardingStatus {
  readonly checked_at: string;
  readonly sources: Record<string, number>;
  readonly harvest: Record<string, unknown>;
  readonly bootstrap: Record<string, unknown>;
  readonly providers: readonly Record<string, unknown>[];
  readonly cli_agents: {
    readonly tools_detected: number;
    readonly active_sessions: number;
    readonly tool_names: readonly string[];
  };
}

interface OnboardingState {
  status: OnboardingStatus | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  runBootstrap: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  status: null,
  loading: false,
  error: null,

  async load() {
    try {
      set({ loading: true, error: null });
      const status = await api.get<OnboardingStatus>("/onboarding/status");
      set({ status, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load onboarding status", loading: false });
    }
  },

  async runBootstrap() {
    try {
      set({ loading: true, error: null });
      await api.post("/onboarding/run", {});
      const status = await api.get<OnboardingStatus>("/onboarding/status");
      set({ status, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to run onboarding bootstrap", loading: false });
    }
  },
}));
