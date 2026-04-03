import { useState, useEffect, useRef, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NativeSelect } from "@/components/ui/NativeSelect";

interface VoiceSettings {
  readonly voice: string;
  readonly speed: number;
  readonly listenMode: "push-to-talk" | "always-on";
  readonly muted: boolean;
  readonly inputDeviceId?: string;
  readonly silenceThreshold?: number;
  readonly whisperModel?: "tiny" | "base";
  readonly wakeWord?: string;
}

interface VoiceMicSetupProps {
  readonly settings: VoiceSettings;
  readonly onSettingsChange: (settings: Partial<VoiceSettings>) => void;
  readonly audioLevel: number;
}

// ── Shared inline style helpers ──

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--pn-text-secondary)",
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid var(--pn-border-subtle)",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: "0.8rem",
  color: "var(--pn-text-primary)",
  outline: "none",
  transition: "border-color 200ms ease",
};

const sectionGap: React.CSSProperties = { marginBottom: 20 };

export function VoiceMicSetup({
  settings,
  onSettingsChange,
  audioLevel,
}: VoiceMicSetupProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testState, setTestState] = useState<
    "idle" | "recording" | "done"
  >("idle");
  const [testWaveform, setTestWaveform] = useState<readonly number[]>([]);

  const testStreamRef = useRef<MediaStream | null>(null);
  const testAnimRef = useRef<number>(0);

  // Enumerate audio input devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first so labels are available
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());

        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "audioinput"));
      } catch {
        // Permission denied or no devices
        setDevices([]);
      }
    }
    loadDevices();
  }, []);

  // Load TTS voices
  useEffect(() => {
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) setTtsVoices(voices);
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Test microphone: record 3 seconds of audio levels
  const handleTestMic = useCallback(async () => {
    if (testState === "recording") return;
    setTestState("recording");
    setTestWaveform([]);

    try {
      const deviceId = settings.inputDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      testStreamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const samples: number[] = [];
      const startTime = Date.now();

      function sample() {
        if (Date.now() - startTime > 3000) {
          // Done
          stream.getTracks().forEach((t) => t.stop());
          audioCtx.close();
          setTestState("done");
          setTestWaveform(samples);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length / 255;
        samples.push(avg);
        setTestWaveform([...samples]);
        testAnimRef.current = requestAnimationFrame(sample);
      }

      testAnimRef.current = requestAnimationFrame(sample);
    } catch {
      setTestState("idle");
    }
  }, [testState, settings.inputDeviceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(testAnimRef.current);
      testStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const silenceThreshold = settings.silenceThreshold ?? 1.5;
  const whisperModel = settings.whisperModel ?? "base";
  const wakeWord = settings.wakeWord ?? "hey ema";

  return (
    <GlassCard title="Microphone Setup">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Input device */}
        <div style={sectionGap}>
          <label style={labelStyle}>Input Device</label>
          <NativeSelect
            value={settings.inputDeviceId ?? ""}
            onChange={(e) =>
              onSettingsChange({ inputDeviceId: e.target.value || undefined })
            }
            uiSize="md"
          >
            <option value="">System Default</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Audio level meter */}
        <div style={sectionGap}>
          <label style={labelStyle}>Microphone Level</label>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-subtle)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(audioLevel * 100, 100)}%`,
                background: audioLevel > 0.8
                  ? "var(--color-pn-error)"
                  : "var(--color-pn-primary-400)",
                borderRadius: 4,
                transition: "width 60ms linear",
              }}
            />
          </div>
        </div>

        {/* Silence threshold */}
        <div style={sectionGap}>
          <label style={labelStyle}>
            Silence Threshold:{" "}
            <span style={{ color: "var(--pn-text-primary)" }}>
              {silenceThreshold.toFixed(1)}s
            </span>
          </label>
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.1}
            value={silenceThreshold}
            onChange={(e) =>
              onSettingsChange({
                silenceThreshold: parseFloat(e.target.value),
              })
            }
            style={{
              width: "100%",
              accentColor: "var(--color-pn-primary-400)",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.65rem",
              color: "var(--pn-text-muted)",
              marginTop: 2,
            }}
          >
            <span>0.5s</span>
            <span>5.0s</span>
          </div>
        </div>

        {/* TTS voice */}
        <div style={sectionGap}>
          <label style={labelStyle}>TTS Voice</label>
          <NativeSelect
            value={settings.voice}
            onChange={(e) => onSettingsChange({ voice: e.target.value })}
            uiSize="md"
          >
            {ttsVoices.length === 0 && (
              <option value={settings.voice}>{settings.voice}</option>
            )}
            {ttsVoices.map((v) => (
              <option key={v.voiceURI} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Whisper model */}
        <div style={sectionGap}>
          <label style={labelStyle}>Whisper Model</label>
          <div style={{ display: "flex", gap: 8 }}>
            <RadioButton
              label="Tiny (fast)"
              checked={whisperModel === "tiny"}
              onChange={() => onSettingsChange({ whisperModel: "tiny" })}
            />
            <RadioButton
              label="Base (accurate)"
              checked={whisperModel === "base"}
              onChange={() => onSettingsChange({ whisperModel: "base" })}
            />
          </div>
        </div>

        {/* Listen mode segmented control */}
        <div style={sectionGap}>
          <label style={labelStyle}>Listen Mode</label>
          <SegmentedControl
            value={settings.listenMode}
            options={
              [
                { value: "push-to-talk", label: "Push to Talk" },
                { value: "always-on", label: "Auto Detect" },
              ] as const
            }
            onChange={(v) => onSettingsChange({ listenMode: v })}
          />
        </div>

        {/* Wake word */}
        <div style={sectionGap}>
          <label style={labelStyle}>Wake Word</label>
          <input
            type="text"
            value={wakeWord}
            onChange={(e) => onSettingsChange({ wakeWord: e.target.value })}
            placeholder="hey ema"
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor =
                "var(--color-pn-primary-400)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--pn-border-subtle)";
            }}
          />
        </div>

        {/* Test microphone */}
        <div>
          <label style={labelStyle}>Test Microphone</label>
          <button
            type="button"
            onClick={handleTestMic}
            disabled={testState === "recording"}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--pn-border-subtle)",
              background:
                testState === "recording"
                  ? "rgba(255, 60, 60, 0.12)"
                  : "rgba(255, 255, 255, 0.04)",
              color:
                testState === "recording"
                  ? "var(--color-pn-error)"
                  : "var(--pn-text-primary)",
              fontSize: "0.78rem",
              cursor:
                testState === "recording" ? "not-allowed" : "pointer",
              transition: "all 200ms ease",
              width: "100%",
            }}
          >
            {testState === "recording"
              ? "Recording (3s)..."
              : testState === "done"
                ? "Test Again"
                : "Record 3 Seconds"}
          </button>

          {/* Waveform visualization */}
          {testWaveform.length > 0 && (
            <div
              style={{
                marginTop: 10,
                height: 40,
                borderRadius: 6,
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--pn-border-subtle)",
                display: "flex",
                alignItems: "flex-end",
                gap: 1,
                padding: "4px",
                overflow: "hidden",
              }}
            >
              {testWaveform.slice(-80).map((v, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    minWidth: 2,
                    height: `${Math.max(v * 100, 2)}%`,
                    background: "var(--color-pn-primary-400)",
                    borderRadius: 1,
                    opacity: 0.7,
                    transition: "height 60ms linear",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ── Radio button ──

function RadioButton({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        flex: 1,
        padding: "8px 12px",
        borderRadius: 6,
        border: `1px solid ${checked ? "var(--color-pn-primary-400)" : "var(--pn-border-subtle)"}`,
        background: checked
          ? "rgba(30, 144, 255, 0.1)"
          : "rgba(255, 255, 255, 0.02)",
        color: checked
          ? "var(--color-pn-primary-400)"
          : "var(--pn-text-secondary)",
        fontSize: "0.78rem",
        cursor: "pointer",
        transition: "all 200ms ease",
        textAlign: "center",
      }}
    >
      {label}
    </button>
  );
}

// ── Segmented control ──

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        borderRadius: 8,
        border: "1px solid var(--pn-border-subtle)",
        background: "rgba(255, 255, 255, 0.02)",
        overflow: "hidden",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "none",
              background: active
                ? "rgba(30, 144, 255, 0.15)"
                : "transparent",
              color: active
                ? "var(--color-pn-primary-400)"
                : "var(--pn-text-tertiary)",
              fontSize: "0.78rem",
              fontWeight: active ? 600 : 400,
              cursor: "pointer",
              transition: "all 200ms ease",
              borderRight:
                opt !== options[options.length - 1]
                  ? "1px solid var(--pn-border-subtle)"
                  : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
