/**
 * VoiceOverlay — persistent floating orb + history panel.
 * Renders at the App.tsx level so it persists across page navigation.
 * Integrates: audio capture, VAD, local Whisper, TTS, voice routing.
 */
import { useEffect, useCallback, useRef } from "react";
import { useVoiceStore } from "@/stores/voice-store";
import { FloatingJarvisOrb } from "./FloatingJarvisOrb";
import { VoiceHistoryPanel } from "./VoiceHistoryPanel";
import {
  initCapture,
  destroyCapture,
  startRecording,
  stopRecording,
  isRecording,
  enableVad,
  disableVad,
} from "@/lib/audio-capture";
import * as tts from "@/lib/voice/tts-engine";
import { routeCommand } from "@/lib/voice/voice-router";

export function VoiceOverlay() {
  const voiceState = useVoiceStore((s) => s.voiceState);
  const audioLevel = useVoiceStore((s) => s.audioLevel);
  const transcript = useVoiceStore((s) => s.transcript);
  const orbVisible = useVoiceStore((s) => s.orbVisible);
  const historyOpen = useVoiceStore((s) => s.historyOpen);
  const settings = useVoiceStore((s) => s.settings);

  const initRef = useRef(false);

  // Initialize audio capture once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        await initCapture(
          (chunk) => useVoiceStore.getState().sendAudioChunk(chunk),
          (level) => useVoiceStore.getState().setAudioLevel(level),
        );
      } catch (err) {
        console.error("[VoiceOverlay] Mic access denied:", err);
      }

      // Connect the WebSocket channel for server-side processing
      useVoiceStore.getState().connect();
    }

    init();
    return () => {
      destroyCapture();
    };
  }, []);

  // Set up VAD when in always-on mode
  useEffect(() => {
    if (settings.listenMode === "always-on" && !settings.muted) {
      enableVad(
        { silenceDurationSec: settings.silenceThreshold },
        () => {
          // Speech started
          if (!isRecording()) {
            startRecording();
            useVoiceStore.getState().setVoiceState("listening");
          }
        },
        () => {
          // Speech ended — finish utterance
          if (isRecording()) {
            stopRecording();
            handleFinishUtterance();
          }
        },
      );
      // Start recording so VAD can monitor
      if (!isRecording()) startRecording();
    } else {
      disableVad();
    }
  }, [settings.listenMode, settings.muted, settings.silenceThreshold]);

  // Listen for custom events (speak-text, toggle-voice-history)
  useEffect(() => {
    const handleSpeak = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail.text;
      if (text) tts.speak(text);
    };
    const handleToggleHistory = () => {
      useVoiceStore.getState().toggleHistory();
    };

    window.addEventListener("ema:speak-text", handleSpeak);
    window.addEventListener("ema:toggle-voice-history", handleToggleHistory);
    return () => {
      window.removeEventListener("ema:speak-text", handleSpeak);
      window.removeEventListener("ema:toggle-voice-history", handleToggleHistory);
    };
  }, []);

  // Sync TTS state with orb
  useEffect(() => {
    const unsub = tts.onStateChange((ttsState) => {
      const store = useVoiceStore.getState();
      if (ttsState === "speaking" && store.voiceState !== "speaking") {
        store.setVoiceState("speaking");
      } else if (ttsState === "idle" && store.voiceState === "speaking") {
        store.setVoiceState("idle");
      }
    });
    return unsub;
  }, []);

  const handleFinishUtterance = useCallback(async () => {
    const store = useVoiceStore.getState();
    store.setVoiceState("processing");

    // Use the channel-based approach (server does transcription + routing)
    store.finishUtterance();
  }, []);

  const handleToggleListening = useCallback(() => {
    const store = useVoiceStore.getState();
    if (store.settings.muted) return;

    if (voiceState === "idle") {
      startRecording();
      store.setVoiceState("listening");
    } else if (voiceState === "listening") {
      stopRecording();
      handleFinishUtterance();
    }
  }, [voiceState, handleFinishUtterance]);

  const handlePushToTalkStart = useCallback(() => {
    const store = useVoiceStore.getState();
    if (store.settings.muted) return;
    startRecording();
    store.setVoiceState("listening");
  }, []);

  const handlePushToTalkEnd = useCallback(() => {
    if (isRecording()) {
      stopRecording();
      handleFinishUtterance();
    }
  }, [handleFinishUtterance]);

  const handleDoubleClick = useCallback(() => {
    useVoiceStore.getState().toggleHistory();
  }, []);

  // Listen for server voice:response events and speak them via local TTS
  useEffect(() => {
    const handleResponse = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (detail.text) tts.speak(detail.text);
    };
    window.addEventListener("ema:voice-response", handleResponse);
    return () => window.removeEventListener("ema:voice-response", handleResponse);
  }, []);

  // Route text commands locally (used when local Whisper transcription completes)
  // Exported via window for use by VoiceControls text input
  useEffect(() => {
    const handler = async (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail.text;
      if (!text) return;
      const store = useVoiceStore.getState();
      store.addTranscriptEntry({ role: "user", text });
      store.setVoiceState("processing");

      const result = await routeCommand(text);
      store.addTranscriptEntry({ role: "assistant", text: result.response, type: result.type });
      tts.speak(result.response);
    };
    window.addEventListener("ema:local-voice-route", handler);
    return () => window.removeEventListener("ema:local-voice-route", handler);
  }, []);

  if (!orbVisible) return null;

  // Use TTS amplitude for speaking state, mic level otherwise
  const effectiveLevel = voiceState === "speaking" ? tts.getAmplitude() : audioLevel;

  return (
    <>
      <FloatingJarvisOrb
        voiceState={voiceState}
        audioLevel={effectiveLevel}
        onToggleListening={handleToggleListening}
        onPushToTalkStart={handlePushToTalkStart}
        onPushToTalkEnd={handlePushToTalkEnd}
        onDoubleClick={handleDoubleClick}
      />
      <VoiceHistoryPanel
        open={historyOpen}
        onClose={() => useVoiceStore.getState().toggleHistory()}
        transcript={transcript}
      />
    </>
  );
}
