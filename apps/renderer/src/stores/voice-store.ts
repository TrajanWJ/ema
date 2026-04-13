import { create } from "zustand";
import type { EncodedAudioChunk } from "@/lib/audio-capture";
import { decodeBase64AudioChunks } from "@/lib/audio-capture";
import { routeCommand } from "@/lib/voice/voice-router";
import { transcribe } from "@/lib/voice/whisper-client";
import {
  onStateChange as onTtsStateChange,
  setRate as setTtsRate,
  setVoice as setTtsVoice,
  speak,
  stop as stopTts,
} from "@/lib/voice/tts-engine";

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
  connected: boolean;
  voiceState: VoiceState;
  transcript: readonly TranscriptEntry[];
  audioLevel: number;
  orbVisible: boolean;
  historyOpen: boolean;
  settings: VoiceSettings;
  _pendingAudioChunks: readonly EncodedAudioChunk[];
  _ttsCleanup: (() => void) | null;

  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudioChunk: (chunk: EncodedAudioChunk) => void;
  finishUtterance: () => Promise<void>;
  sendText: (text: string) => Promise<void>;
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
    useLocalWhisper: true,
  };
}

function persistSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // quota exceeded — ignore
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function speakIfAllowed(
  response: string,
  set: (fn: Partial<VoiceStoreState> | ((state: VoiceStoreState) => Partial<VoiceStoreState>)) => void,
  get: () => VoiceStoreState,
): Promise<void> {
  if (!response.trim() || get().settings.muted) {
    set({ voiceState: "idle" });
    return;
  }

  set({ voiceState: "speaking" });

  try {
    await speak(response);
  } catch (err) {
    console.error("Speech synthesis failed:", err);
    set({ voiceState: "idle" });
  }
}

async function runJarvisTurn(
  text: string,
  set: (fn: Partial<VoiceStoreState> | ((state: VoiceStoreState) => Partial<VoiceStoreState>)) => void,
  get: () => VoiceStoreState,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    set({ voiceState: "idle" });
    return;
  }

  const userEntry: TranscriptEntry = {
    id: makeId("user"),
    role: "user",
    text: trimmed,
    timestamp: new Date().toISOString(),
  };

  set((state) => ({
    transcript: [...state.transcript, userEntry],
    voiceState: "processing",
  }));

  try {
    const result = await routeCommand(trimmed);
    const assistantEntry: TranscriptEntry = {
      id: makeId("assistant"),
      role: "assistant",
      text: result.response,
      type: result.type,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      transcript: [...state.transcript, assistantEntry],
    }));

    await speakIfAllowed(result.response, set, get);
  } catch (err) {
    console.error("Voice turn failed:", err);
    const assistantEntry: TranscriptEntry = {
      id: makeId("assistant"),
      role: "assistant",
      text: "I hit an error while processing that.",
      type: "conversation",
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      transcript: [...state.transcript, assistantEntry],
      voiceState: "error",
    }));

    setTimeout(() => {
      if (get().voiceState === "error") {
        set({ voiceState: "idle" });
      }
    }, 1500);
  }
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => ({
  connected: false,
  voiceState: "idle",
  transcript: [],
  audioLevel: 0,
  orbVisible: true,
  historyOpen: false,
  settings: loadPersistedSettings(),
  _pendingAudioChunks: [],
  _ttsCleanup: null,

  async connect() {
    if (get().connected) return;

    const settings = get().settings;
    setTtsVoice(settings.voice);
    setTtsRate(settings.speed);

    const cleanup = onTtsStateChange((state) => {
      const current = get();
      if (state === "speaking") {
        set({ voiceState: "speaking" });
        return;
      }

      if (state === "idle" && current.voiceState === "speaking") {
        set({ voiceState: "idle", audioLevel: 0 });
      }
    });

    set({
      connected: true,
      voiceState: "idle",
      _ttsCleanup: cleanup,
    });
  },

  disconnect() {
    get()._ttsCleanup?.();
    stopTts();
    set({
      connected: false,
      voiceState: "idle",
      audioLevel: 0,
      _pendingAudioChunks: [],
      _ttsCleanup: null,
    });
  },

  sendAudioChunk(chunk: EncodedAudioChunk) {
    set((state) => ({
      _pendingAudioChunks: [...state._pendingAudioChunks, chunk],
      voiceState:
        state.voiceState === "processing" || state.voiceState === "speaking"
          ? state.voiceState
          : "listening",
    }));
  },

  async finishUtterance() {
    const chunks = [...get()._pendingAudioChunks];
    set({ _pendingAudioChunks: [], audioLevel: 0 });

    if (chunks.length === 0) {
      set({ voiceState: "idle" });
      return;
    }

    set({ voiceState: "processing" });

    try {
      const audio = await decodeBase64AudioChunks(chunks);
      const result = await transcribe(audio, get().settings.whisperModel);

      if (!result.text.trim()) {
        set({ voiceState: "idle" });
        return;
      }

      await runJarvisTurn(result.text, set, get);
    } catch (err) {
      console.error("Transcription pipeline failed:", err);
      set({ voiceState: "error" });
      setTimeout(() => {
        if (get().voiceState === "error") {
          set({ voiceState: "idle" });
        }
      }, 1500);
    }
  },

  async sendText(text: string) {
    await runJarvisTurn(text, set, get);
  },

  clearSession() {
    stopTts();
    set({
      transcript: [],
      _pendingAudioChunks: [],
      voiceState: "idle",
      audioLevel: 0,
    });
  },

  setVoiceState(voiceState: VoiceState) {
    set({ voiceState });
  },

  setAudioLevel(audioLevel: number) {
    set({ audioLevel });
  },

  updateSettings(partial: Partial<VoiceSettings>) {
    const settings = { ...get().settings, ...partial };
    persistSettings(settings);
    set({ settings });

    if (partial.voice !== undefined) {
      setTtsVoice(settings.voice);
    }
    if (partial.speed !== undefined) {
      setTtsRate(settings.speed);
    }
    if (partial.muted === true) {
      stopTts();
      set({ voiceState: "idle" });
    }
  },

  toggleMute() {
    const settings = {
      ...get().settings,
      muted: !get().settings.muted,
    };
    persistSettings(settings);
    set({ settings });

    if (settings.muted) {
      stopTts();
      set({ voiceState: "idle" });
    }
  },

  setOrbVisible(orbVisible: boolean) {
    set({ orbVisible });
  },

  toggleHistory() {
    set((state) => ({ historyOpen: !state.historyOpen }));
  },

  addTranscriptEntry(entry: Omit<TranscriptEntry, "id" | "timestamp">) {
    const full: TranscriptEntry = {
      ...entry,
      id: makeId("entry"),
      timestamp: new Date().toISOString(),
    };
    set((state) => ({ transcript: [...state.transcript, full] }));
  },
}));
