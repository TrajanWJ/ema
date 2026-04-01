import { useEffect, useCallback } from "react";
import { useVoiceStore } from "@/stores/voice-store";
import { JarvisOrb } from "./JarvisOrb";
import { TranscriptPanel } from "./TranscriptPanel";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { VoiceControls } from "./VoiceControls";
import {
  initCapture,
  destroyCapture,
  initTtsPlayback,
} from "@/lib/audio-capture";

export function VoiceApp() {
  const connected = useVoiceStore((s) => s.connected);
  const voiceState = useVoiceStore((s) => s.voiceState);
  const audioLevel = useVoiceStore((s) => s.audioLevel);
  const transcript = useVoiceStore((s) => s.transcript);
  const connect = useVoiceStore((s) => s.connect);
  const disconnect = useVoiceStore((s) => s.disconnect);
  const sendAudioChunk = useVoiceStore((s) => s.sendAudioChunk);
  const setAudioLevel = useVoiceStore((s) => s.setAudioLevel);

  // Initialize voice channel and audio on mount
  useEffect(() => {
    let cleanupTts: (() => void) | undefined;

    async function init() {
      await connect();

      try {
        await initCapture(
          (chunk) => sendAudioChunk(chunk),
          (level) => setAudioLevel(level),
        );
      } catch (err) {
        console.error("Microphone access denied:", err);
      }

      cleanupTts = initTtsPlayback();
    }

    init();

    return () => {
      cleanupTts?.();
      destroyCapture();
      disconnect();
    };
  }, []);

  const handleOrbClick = useCallback(() => {
    // Quick toggle for push-to-talk via orb click
    const store = useVoiceStore.getState();
    if (store.settings.listenMode !== "push-to-talk") return;

    if (voiceState === "idle") {
      import("@/lib/audio-capture").then(({ startRecording }) => {
        startRecording();
        store.setVoiceState("listening");
      });
    } else if (voiceState === "listening") {
      import("@/lib/audio-capture").then(({ stopRecording }) => {
        stopRecording();
        store.finishUtterance();
      });
    }
  }, [voiceState]);

  if (!connected) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: "rgba(8, 9, 14, 0.95)" }}
      >
        <div className="text-center space-y-3">
          <div
            className="w-12 h-12 mx-auto rounded-full animate-pulse"
            style={{
              background: "radial-gradient(circle, rgba(30, 144, 255, 0.3), transparent)",
              boxShadow: "0 0 40px rgba(0, 210, 255, 0.1)",
            }}
          />
          <p className="text-sm" style={{ color: "var(--pn-text-secondary)" }}>
            Initializing Jarvis...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "rgba(8, 9, 14, 0.95)" }}
    >
      {/* Title bar drag region */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        data-tauri-drag-region
      >
        <span
          className="text-xs font-medium tracking-[0.15em] uppercase"
          style={{ color: "rgba(0, 210, 255, 0.5)" }}
        >
          Jarvis
        </span>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background:
                voiceState === "error"
                  ? "var(--color-pn-error)"
                  : "var(--color-pn-success)",
              boxShadow:
                voiceState === "error"
                  ? "0 0 6px var(--color-pn-error)"
                  : "0 0 6px var(--color-pn-success)",
            }}
          />
          <span
            className="text-[0.65rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {voiceState === "error" ? "Error" : "Connected"}
          </span>
        </div>
      </div>

      {/* Main content area - two column layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Orb + Waveform */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-[360px]">
            <JarvisOrb
              state={voiceState}
              audioLevel={audioLevel}
              onClick={handleOrbClick}
            />
          </div>

          <div className="w-full max-w-[320px] mt-4">
            <WaveformVisualizer
              active={voiceState === "listening"}
            />
          </div>
        </div>

        {/* Right: Transcript */}
        <div
          className="w-[340px] flex flex-col p-4 shrink-0"
          style={{
            borderLeft: "1px solid var(--pn-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-medium tracking-wider uppercase"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              Transcript
            </span>
            <span
              className="text-[0.6rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {transcript.length} messages
            </span>
          </div>
          <TranscriptPanel transcript={transcript} />
        </div>
      </div>

      {/* Bottom: Controls */}
      <div
        className="shrink-0 px-6 py-4"
        style={{
          borderTop: "1px solid var(--pn-border-subtle)",
          background: "rgba(14, 16, 23, 0.4)",
        }}
      >
        <VoiceControls />
      </div>
    </div>
  );
}
