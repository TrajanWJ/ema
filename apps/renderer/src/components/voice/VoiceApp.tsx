import { useEffect, useCallback } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useVoiceStore } from "@/stores/voice-store";
import { JarvisOrb } from "./JarvisOrb";
import { TranscriptPanel } from "./TranscriptPanel";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { VoiceControls } from "./VoiceControls";
import { PhoneMicConnect } from "./PhoneMicConnect";
import { APP_CONFIGS } from "@/types/workspace";
import {
  destroyCapture,
  initCapture,
  startRecording,
  stopRecording,
} from "@/lib/audio-capture";

const config = APP_CONFIGS.voice;

export function VoiceApp() {
  const connected = useVoiceStore((s) => s.connected);
  const voiceState = useVoiceStore((s) => s.voiceState);
  const audioLevel = useVoiceStore((s) => s.audioLevel);
  const transcript = useVoiceStore((s) => s.transcript);
  const connect = useVoiceStore((s) => s.connect);
  const disconnect = useVoiceStore((s) => s.disconnect);
  const sendAudioChunk = useVoiceStore((s) => s.sendAudioChunk);
  const setAudioLevel = useVoiceStore((s) => s.setAudioLevel);

  // Initialize local voice runtime on mount
  useEffect(() => {
    async function init() {
      await connect();
    }

    void init();

    return () => {
      destroyCapture();
      disconnect();
    };
  }, [connect, disconnect]);

  const handleOrbClick = useCallback(() => {
    // Quick toggle for push-to-talk via orb click
    const store = useVoiceStore.getState();
    if (store.settings.listenMode !== "push-to-talk") return;

    if (voiceState === "idle") {
      void initCapture(
        (chunk) => sendAudioChunk(chunk),
        (level) => setAudioLevel(level),
      )
        .then(() => {
          startRecording();
          store.setVoiceState("listening");
        })
        .catch((err) => {
          console.error("Microphone access denied:", err);
        });
    } else if (voiceState === "listening") {
      stopRecording();
      void store.finishUtterance();
    }
  }, [voiceState, sendAudioChunk, setAudioLevel]);

  if (!connected) {
    return (
      <AppWindowChrome appId="voice" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-3">
            <div
              className="w-12 h-12 mx-auto rounded-full animate-pulse"
              style={{
                background: "radial-gradient(circle, rgba(30, 144, 255, 0.24), transparent)",
                boxShadow: "0 0 40px rgba(0, 210, 255, 0.12)",
              }}
            />
            <p className="text-sm" style={{ color: "var(--pn-text-secondary)" }}>
              Initializing Jarvis...
            </p>
          </div>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome
      appId="voice"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={voiceState === "idle" ? "Ready" : voiceState}
    >
      <div className="h-full flex flex-col overflow-hidden">
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
          style={{
            borderBottom: "1px solid var(--pn-border-subtle)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
          }}
        >
          <div>
            <div
              className="text-[0.65rem] font-medium tracking-[0.18em] uppercase"
              style={{ color: "rgba(0, 210, 255, 0.68)" }}
            >
              Voice Session
            </div>
            <p className="text-sm mt-1" style={{ color: "var(--pn-text-secondary)" }}>
              Local Jarvis loop with desktop mic and phone mic relay.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  voiceState === "error"
                    ? "var(--color-pn-error)"
                    : voiceState === "speaking"
                      ? "var(--color-pn-warning)"
                      : "var(--color-pn-success)",
                boxShadow:
                  voiceState === "error"
                    ? "0 0 8px color-mix(in srgb, var(--color-pn-error) 70%, transparent)"
                    : "0 0 8px color-mix(in srgb, var(--color-pn-success) 70%, transparent)",
              }}
            />
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
              {voiceState}
            </span>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-5">
            <div className="w-full max-w-[360px]">
              <JarvisOrb
                state={voiceState}
                audioLevel={audioLevel}
                onClick={handleOrbClick}
              />
            </div>

            <div className="w-full max-w-[320px] mt-4">
              <WaveformVisualizer active={voiceState === "listening"} />
            </div>
          </div>

          <div
            className="w-[340px] flex flex-col p-4 shrink-0"
            style={{
              borderLeft: "1px solid var(--pn-border-subtle)",
              background: "rgba(255,255,255,0.015)",
            }}
          >
            <PhoneMicConnect />

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

        <div
          className="shrink-0 px-6 py-4"
          style={{
            borderTop: "1px solid var(--pn-border-subtle)",
            background: "rgba(255,255,255,0.018)",
          }}
        >
          <VoiceControls />
        </div>
      </div>
    </AppWindowChrome>
  );
}
