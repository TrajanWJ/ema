import { create } from "zustand";
import { api } from "@/lib/api";

export interface IntegrationStatus {
  connected: boolean;
  username?: string | null;
  workspace_name?: string | null;
  notification_channel?: string | null;
  linked_repos?: number | null;
  linked_folders?: number | null;
}

interface IntegrationsState {
  github: IntegrationStatus;
  slack: IntegrationStatus;
  google_drive: IntegrationStatus;
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  connect: (service: string, token: string) => Promise<void>;
  disconnect: (service: string) => Promise<void>;
}

const defaultStatus: IntegrationStatus = { connected: false };

export const useIntegrationsStore = create<IntegrationsState>((set) => ({
  github: { ...defaultStatus },
  slack: { ...defaultStatus },
  google_drive: { ...defaultStatus },
  loading: false,
  error: null,

  async fetchStatus() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{
        github: IntegrationStatus;
        slack: IntegrationStatus;
        google_drive: IntegrationStatus;
      }>("/integrations/status");
      set({
        github: data.github,
        slack: data.slack,
        google_drive: data.google_drive,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch status",
      });
    }
  },

  async connect(service: string, token: string) {
    set({ error: null });
    try {
      const data = await api.post<IntegrationStatus>(
        `/integrations/${service}/connect`,
        { token },
      );
      set({ [service]: data } as Partial<IntegrationsState>);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : `Failed to connect ${service}`,
      });
    }
  },

  async disconnect(service: string) {
    // No DELETE endpoint exists — just clear local state
    set({ [service]: { connected: false } } as Partial<IntegrationsState>);
  },
}));
