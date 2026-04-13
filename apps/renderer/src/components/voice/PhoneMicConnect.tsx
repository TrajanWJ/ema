import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { joinChannel, type Channel } from "@/lib/ws";
import { useVoiceStore } from "@/stores/voice-store";

interface ConnectInfo {
  pair_id: string;
  preferred_url: string;
  urls: string[];
  qr_svg_url: string;
}

export function PhoneMicConnect() {
  const [pairId] = useState(() => `voice-${crypto.randomUUID()}`);
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const sendAudioChunk = useVoiceStore((s) => s.sendAudioChunk);
  const finishUtterance = useVoiceStore((s) => s.finishUtterance);
  const setAudioLevel = useVoiceStore((s) => s.setAudioLevel);
  const setVoiceState = useVoiceStore((s) => s.setVoiceState);
  const voiceState = useVoiceStore((s) => s.voiceState);

  useEffect(() => {
    let disposed = false;
    let remoteChannel: Channel | null = null;

    async function init() {
      try {
        const connectInfo = await api.get<ConnectInfo>(
          `/voice/connect-info?pair_id=${encodeURIComponent(pairId)}`,
        );
        if (disposed) return;
        setInfo(connectInfo);
      } catch (err) {
        const message = describeConnectError(err);
        if (!disposed) {
          setFatalError(message);
          setLoading(false);
        }
        return;
      }

      try {
        const joined = await joinChannel(`voice_remote:${pairId}`);
        if (disposed) {
          joined.channel.leave();
          return;
        }

        remoteChannel = joined.channel;
        setChannel(joined.channel);

        joined.channel.on("phone:ready", () => {
          setPhoneConnected(true);
        });

        joined.channel.on("phone:left", () => {
          setPhoneConnected(false);
          setAudioLevel(0);
          if (useVoiceStore.getState().voiceState === "listening") {
            setVoiceState("idle");
          }
        });

        joined.channel.on("phone:mic_chunk", (payload: { data?: string; mimeType?: string }) => {
          if (typeof payload.data !== "string" || payload.data.length === 0) return;
          setPhoneConnected(true);
          sendAudioChunk({
            data: payload.data,
            mimeType:
              typeof payload.mimeType === "string" && payload.mimeType.length > 0
                ? payload.mimeType
                : "audio/webm",
          });
        });

        joined.channel.on("phone:mic_finish", () => {
          setAudioLevel(0);
          void finishUtterance();
        });
      } catch (err) {
        const message = describeJoinError(err);
        if (!disposed) {
          setWarning(message);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      disposed = true;
      remoteChannel?.leave();
    };
  }, [finishUtterance, pairId, sendAudioChunk, setAudioLevel, setVoiceState]);

  useEffect(() => {
    if (!channel) return;
    channel.push("desktop:state", { state: voiceState });
  }, [channel, voiceState]);

  const statusLabel = useMemo(() => {
    if (phoneConnected) return "Phone connected";
    if (loading) return "Preparing link";
    return "Waiting for scan";
  }, [loading, phoneConnected]);

  const handleCopy = async () => {
    if (!info?.preferred_url) return;
    try {
      await navigator.clipboard.writeText(info.preferred_url);
    } catch {
      // clipboard can fail on some Electron shells; ignore
    }
  };

  return (
    <div
      className="mb-4 rounded-xl p-3"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid var(--pn-border-subtle)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div
            className="text-[0.65rem] font-medium tracking-[0.18em] uppercase"
            style={{ color: "rgba(0, 210, 255, 0.72)" }}
          >
            Connect Phone
          </div>
          <p
            className="text-[0.72rem] mt-1 leading-relaxed"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Scan the QR code to use your phone as Jarvis&apos;s microphone.
          </p>
        </div>
        <div
          className="px-2 py-1 rounded-full text-[0.65rem]"
          style={{
            background: phoneConnected
              ? "rgba(39, 174, 96, 0.18)"
              : "rgba(255, 255, 255, 0.05)",
            color: phoneConnected
              ? "var(--color-pn-success)"
              : "var(--pn-text-muted)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {statusLabel}
        </div>
      </div>

      {fatalError ? (
        <p className="text-xs" style={{ color: "var(--color-pn-error)" }}>
          {fatalError}
        </p>
      ) : (
        <>
          {warning && (
            <p className="text-xs mb-3" style={{ color: "var(--color-pn-error)" }}>
              {warning}
            </p>
          )}
          <div
            className="rounded-lg overflow-hidden flex items-center justify-center"
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              minHeight: 184,
            }}
          >
            {info ? (
              <img
                src={info.qr_svg_url}
                alt="Connect phone QR code"
                className="w-full max-w-[184px]"
              />
            ) : (
              <span className="text-xs" style={{ color: "#234" }}>
                Generating QR...
              </span>
            )}
          </div>

          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!info?.preferred_url}
              className="w-full px-3 py-2 rounded-lg text-xs transition-all"
              style={{
                background: "rgba(30, 144, 255, 0.14)",
                border: "1px solid rgba(0, 210, 255, 0.2)",
                color: "rgba(0, 210, 255, 0.82)",
              }}
            >
              Copy connect link
            </button>

            {info?.preferred_url && (
              <div
                className="text-[0.65rem] leading-relaxed break-all rounded-lg px-2.5 py-2"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  color: "var(--pn-text-muted)",
                }}
              >
                {info.preferred_url}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function describeConnectError(err: unknown): string {
  const message = err instanceof Error ? err.message.trim() : "";
  if (message === "unknown" || message === "HTTP 404") {
    return "Phone connect route is not available in the running EMA services process. Restart EMA services or the desktop app.";
  }
  if (message) return message;
  return "Phone connect failed to initialize.";
}

function describeJoinError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    return `Phone relay is not live yet: ${err.message.trim()}`;
  }
  return "Phone relay websocket is not live yet. Restart EMA services or the desktop app, then rescan.";
}
