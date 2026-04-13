import { useCallback, useState } from "react";
import { useVoiceStore } from "@/stores/voice-store";
import {
  startRecording,
  stopRecording,
  isRecording,
} from "@/lib/audio-capture";

export function VoiceControls() {
  const voiceState = useVoiceStore((s) => s.voiceState);
  const settings = useVoiceStore((s) => s.settings);
  const finishUtterance = useVoiceStore((s) => s.finishUtterance);
  const updateSettings = useVoiceStore((s) => s.updateSettings);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const clearSession = useVoiceStore((s) => s.clearSession);
  const sendText = useVoiceStore((s) => s.sendText);
  const setVoiceState = useVoiceStore((s) => s.setVoiceState);

  const [textInput, setTextInput] = useState("");

  const handlePushToTalkDown = useCallback(() => {
    if (settings.muted || voiceState === "processing") return;
    startRecording();
    setVoiceState("listening");
  }, [settings.muted, voiceState, setVoiceState]);

  const handlePushToTalkUp = useCallback(() => {
    if (!isRecording()) return;
    stopRecording();
    finishUtterance();
  }, [finishUtterance]);

  const handleAlwaysListenToggle = useCallback(() => {
    if (settings.listenMode === "always-on" && isRecording()) {
      stopRecording();
      setVoiceState("idle");
      updateSettings({ listenMode: "push-to-talk" });
    } else {
      updateSettings({ listenMode: "always-on" });
      startRecording();
      setVoiceState("listening");
    }
  }, [settings.listenMode, updateSettings, setVoiceState]);

  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = textInput.trim();
      if (!text) return;
      sendText(text);
      setTextInput("");
    },
    [textInput, sendText],
  );

  const handleVoiceChange = useCallback(
    (voice: string) => {
      updateSettings({ voice });
    },
    [updateSettings],
  );

  const isActive = voiceState === "listening" || voiceState === "processing";

  return (
    <div className="space-y-4">
      {/* Main controls row */}
      <div className="flex items-center justify-center gap-4">
        {/* Push-to-talk button */}
        {settings.listenMode === "push-to-talk" && (
          <button
            type="button"
            onMouseDown={handlePushToTalkDown}
            onMouseUp={handlePushToTalkUp}
            onMouseLeave={handlePushToTalkUp}
            onTouchStart={handlePushToTalkDown}
            onTouchEnd={handlePushToTalkUp}
            disabled={settings.muted || voiceState === "processing"}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: isActive
                ? "rgba(30, 144, 255, 0.25)"
                : "rgba(255, 255, 255, 0.06)",
              border: `2px solid ${
                isActive
                  ? "rgba(0, 210, 255, 0.5)"
                  : "rgba(255, 255, 255, 0.1)"
              }`,
              boxShadow: isActive
                ? "0 0 20px rgba(0, 210, 255, 0.2)"
                : "none",
              opacity: settings.muted ? 0.4 : 1,
              cursor: settings.muted ? "not-allowed" : "pointer",
            }}
          >
            <MicIcon active={isActive} />
          </button>
        )}

        {/* Always-listen toggle */}
        <button
          type="button"
          onClick={handleAlwaysListenToggle}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
          style={{
            background:
              settings.listenMode === "always-on"
                ? "rgba(30, 144, 255, 0.15)"
                : "rgba(255, 255, 255, 0.04)",
            border: `1px solid ${
              settings.listenMode === "always-on"
                ? "rgba(0, 210, 255, 0.3)"
                : "var(--pn-border-subtle)"
            }`,
            color:
              settings.listenMode === "always-on"
                ? "rgba(0, 210, 255, 0.8)"
                : "var(--pn-text-secondary)",
          }}
        >
          <WaveIcon />
          {settings.listenMode === "always-on" ? "Always On" : "Auto-Listen"}
        </button>

        {/* Mute button */}
        <button
          type="button"
          onClick={toggleMute}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
          style={{
            background: settings.muted
              ? "rgba(226, 75, 74, 0.15)"
              : "rgba(255, 255, 255, 0.04)",
            border: `1px solid ${
              settings.muted
                ? "rgba(226, 75, 74, 0.3)"
                : "var(--pn-border-subtle)"
            }`,
            color: settings.muted
              ? "var(--color-pn-error)"
              : "var(--pn-text-secondary)",
          }}
        >
          {settings.muted ? <MuteIcon /> : <UnmuteIcon />}
          {settings.muted ? "Muted" : "Mute"}
        </button>

        {/* Clear session */}
        <button
          type="button"
          onClick={clearSession}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--pn-border-subtle)",
            color: "var(--pn-text-secondary)",
          }}
        >
          <ClearIcon />
          Clear
        </button>
      </div>

      {/* Voice selector */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>
          Voice:
        </span>
        {["onyx", "alloy", "echo", "fable", "nova", "shimmer"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => handleVoiceChange(v)}
            className="px-2 py-1 rounded text-xs capitalize transition-all"
            style={{
              background:
                settings.voice === v
                  ? "rgba(30, 144, 255, 0.15)"
                  : "transparent",
              border: `1px solid ${
                settings.voice === v
                  ? "rgba(0, 210, 255, 0.3)"
                  : "transparent"
              }`,
              color:
                settings.voice === v
                  ? "rgba(0, 210, 255, 0.8)"
                  : "var(--pn-text-tertiary)",
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Text input fallback */}
      <form onSubmit={handleTextSubmit} className="flex gap-2">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type a command or question..."
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--pn-border-subtle)",
            color: "var(--pn-text-primary)",
          }}
        />
        <button
          type="submit"
          disabled={!textInput.trim()}
          className="px-4 py-2 rounded-lg text-sm transition-all"
          style={{
            background: textInput.trim()
              ? "rgba(30, 144, 255, 0.2)"
              : "rgba(255, 255, 255, 0.04)",
            border: `1px solid ${
              textInput.trim()
                ? "rgba(0, 210, 255, 0.3)"
                : "var(--pn-border-subtle)"
            }`,
            color: textInput.trim()
              ? "rgba(0, 210, 255, 0.8)"
              : "var(--pn-text-muted)",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ── Inline SVG Icons ──

function MicIcon({ active }: { active: boolean }) {
  const color = active ? "rgba(0, 210, 255, 0.9)" : "var(--pn-text-secondary)";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 12h2l3-9 4 18 4-18 3 9h2" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" x2="23" y1="1" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.34 2.18" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function UnmuteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
