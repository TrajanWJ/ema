import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";
export type ListenMode = "push-to-talk" | "always-on";

export interface TranscriptEntry {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly type?: "command" | "conversation";
  readonly timestamp: string;
}

export interface VoiceSettings {
  voice: string;
  speed: number;
  listenMode: ListenMode;
  muted: boolean;
  inputDeviceId: string;
  silenceThreshold: number;
  whisperModel: "tiny" | "base";
  wakeWord: string;
  useLocalWhisper: boolean;
}

interface VoiceStoreState {
  // Connection
  channel: Channel | null;
  sessionId: string | null;
  connected: boolean;

  // Voice state
  voiceState: VoiceState;
  transcript: readonly TranscriptEntry[];
  audioLevel: number;

  // Floating orb
  orbVisible: boolean;
  historyOpen: boolean;

  // Settings
  settings: VoiceSettings;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudioChunk: (base64Data: string) => void;
  finishUtterance: () => void;
  sendText: (text: string) => void;
  clearSession: () => void;
  setVoiceState: (state: VoiceState) => void;
  setAudioLevel: (level: number) => void;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  toggleMute: () => void;
  setOrbVisible: (visible: boolean) => void;
  toggleHistory: () => void;
  addTranscriptEntry: (entry: Omit<TranscriptEntry, "id" | "timestamp">) => void;
}

const SETTINGS_KEY = "ema-voice-settings";

function loadPersistedSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as VoiceSettings;
  } catch {
    // corrupt storage — use defaults
  }
  return {
    voice: "onyx",
    speed: 1.0,
    listenMode: "push-to-talk",
    muted: false,
    inputDeviceId: "",
    silenceThreshold: 1.5,
    whisperModel: "tiny",
    wakeWord: "hey ema",
    useLocalWhisper: false,
  };
}

function persistSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // quota exceeded — ignore
  }
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => ({
  channel: null,
  sessionId: null,
  connected: false,
  voiceState: "idle",
  transcript: [],
  audioLevel: 0,
  orbVisible: true,
  historyOpen: false,
  settings: loadPersistedSettings(),

  async connect() {
    try {
      const { channel, response } = await joinChannel("voice:session");
      const data = response as { session_id: string };

      set({ channel, sessionId: data.session_id, connected: true });

      // Listen for voice events
      channel.on("voice:ready", (payload: { session_id: string }) => {
        set({ sessionId: payload.session_id });
      });

      channel.on("voice:state", (payload: { state: string }) => {
        set({ voiceState: payload.state as VoiceState });
      });

      channel.on("voice:transcription", (payload: { text: string; role: string }) => {
        const entry: TranscriptEntry = {
          id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: payload.role as "user" | "assistant",
          text: payload.text,
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ transcript: [...s.transcript, entry] }));
      });

      channel.on(
        "voice:response",
        (payload: { text: string; role: string; type: string }) => {
          const entry: TranscriptEntry = {
            id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role: "assistant",
            text: payload.text,
            type: payload.type as "command" | "conversation",
            timestamp: new Date().toISOString(),
          };
          set((s) => ({
            transcript: [...s.transcript, entry],
            voiceState: "speaking",
          }));
        },
      );

      channel.on("voice:error", (payload: { error: string }) => {
        console.error("Voice error:", payload.error);
        set({ voiceState: "error" });
        // Auto-recover to idle after 2s
        setTimeout(() => {
          const state = get();
          if (state.voiceState === "error") set({ voiceState: "idle" });
        }, 2000);
      });

      channel.on("tts:chunk", (payload: { data: string; final: boolean }) => {
        // Dispatch to audio playback (handled by audio-capture module)
        window.dispatchEvent(
          new CustomEvent("ema:tts-chunk", {
            detail: { data: payload.data, final: payload.final },
          }),
        );

        if (payload.final) {
          // When TTS finishes, return to idle after a short delay
          setTimeout(() => set({ voiceState: "idle" }), 500);
        }
      });

      channel.on("voice:session_cleared", (payload: { session_id: string }) => {
        set({ sessionId: payload.session_id, transcript: [], voiceState: "idle" });
      });

      channel.on("voice:session_ended", () => {
        set({ voiceState: "idle", connected: false, channel: null, sessionId: null });
      });
    } catch (err) {
      console.error("Failed to connect voice channel:", err);
      set({ voiceState: "error" });
    }
  },

  disconnect() {
    const { channel } = get();
    if (channel) {
      channel.leave();
    }
    set({ channel: null, connected: false, sessionId: null, voiceState: "idle" });
  },

  sendAudioChunk(base64Data: string) {
    const { channel } = get();
    channel?.push("audio:chunk", { data: base64Data });
  },

  finishUtterance() {
    const { channel } = get();
    channel?.push("audio:finish", {});
    set({ voiceState: "processing" });
  },

  sendText(text: string) {
    const { channel } = get();
    if (!channel) return;

    const entry: TranscriptEntry = {
      id: `t-${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      transcript: [...s.transcript, entry],
      voiceState: "processing",
    }));

    channel.push("text:send", { text });
  },

  clearSession() {
    const { channel } = get();
    channel?.push("session:clear", {});
  },

  setVoiceState(voiceState: VoiceState) {
    set({ voiceState });
  },

  setAudioLevel(audioLevel: number) {
    set({ audioLevel });
  },

  updateSettings(partial: Partial<VoiceSettings>) {
    const { channel, settings } = get();
    const updated = { ...settings, ...partial };
    set({ settings: updated });
    persistSettings(updated);

    // Sync TTS config to backend
    if (partial.voice !== undefined || partial.speed !== undefined) {
      channel?.push("tts:config", { voice: updated.voice, speed: updated.speed });
    }
  },

  toggleMute() {
    set((s) => ({
      settings: { ...s.settings, muted: !s.settings.muted },
    }));
  },

  setOrbVisible(orbVisible: boolean) {
    set({ orbVisible });
  },

  toggleHistory() {
    set((s) => ({ historyOpen: !s.historyOpen }));
  },

  addTranscriptEntry(entry: Omit<TranscriptEntry, "id" | "timestamp">) {
    const full: TranscriptEntry = {
      ...entry,
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ transcript: [...s.transcript, full] }));
  },
}));
