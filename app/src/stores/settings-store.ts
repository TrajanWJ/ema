import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { AppSettings } from "@/types/settings";

const DEFAULT_SETTINGS: AppSettings = {
  color_mode: "dark",
  accent_color: "#2DD4A8",
  glass_intensity: "normal",
  font_family: "system-ui",
  font_size: "14",
  launch_on_boot: "false",
  start_minimized: "false",
  shortcut_capture: "CmdOrCtrl+Shift+Space",
  shortcut_toggle: "CmdOrCtrl+Shift+P",
};

interface SettingsState {
  settings: AppSettings;
  connected: boolean;
  channel: Channel | null;
  load: () => Promise<void>;
  connect: () => Promise<void>;
  set: (key: string, value: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  connected: false,
  channel: null,

  async load() {
    const response = await api.get<Record<string, string>>("/settings");
    set({ settings: { ...DEFAULT_SETTINGS, ...response } as AppSettings });
  },

  async connect() {
    const [{ channel }, response] = await Promise.all([
      joinChannel("settings:sync"),
      api.get<Record<string, string>>("/settings"),
    ]);

    set({
      channel,
      connected: true,
      settings: { ...DEFAULT_SETTINGS, ...response } as AppSettings,
    });

    channel.on("setting_updated", (payload: { key: string; value: string }) => {
      set((state) => ({
        settings: { ...state.settings, [payload.key]: payload.value } as AppSettings,
      }));
    });
  },

  async set(key, value) {
    await api.put("/settings", { key, value });
    set((state) => ({
      settings: { ...state.settings, [key]: value } as AppSettings,
    }));
  },
}));
