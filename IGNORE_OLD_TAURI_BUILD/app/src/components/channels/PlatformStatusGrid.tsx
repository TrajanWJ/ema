import { useEffect, useState } from "react";
import { useChannelsStore, type Platform } from "@/stores/channels-store";

const PLATFORM_COLORS: Record<string, string> = {
  discord: "#5865F2",
  telegram: "#229ED9",
  slack: "#4A154B",
  matrix: "#0DBD8B",
  signal: "#3A76F0",
  whatsapp: "#25D366",
  irc: "#6b95f0",
  webchat: "#5eead4",
  teams: "#6264A7",
};

export function PlatformStatusGrid() {
  const platforms = useChannelsStore((s) => s.platforms);
  const loadPlatforms = useChannelsStore((s) => s.loadPlatforms);
  const [sendPlatform, setSendPlatform] = useState<string | null>(null);
  const [sendChannel, setSendChannel] = useState("");
  const [sendContent, setSendContent] = useState("");

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  const connected = platforms.filter((p) => p.status === "connected");
  const notConnected = platforms.filter((p) => p.status !== "connected");

  async function handleSend() {
    if (!sendPlatform || !sendChannel.trim() || !sendContent.trim()) return;
    await useChannelsStore.getState().sendCrossPlatform(sendPlatform, sendChannel, sendContent);
    setSendContent("");
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Summary */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          Platforms
        </span>
        <span className="text-[0.65rem] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22C55E" }}>
          {connected.length} connected
        </span>
        <span className="text-[0.65rem] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(107,114,128,0.1)", color: "#6b7280" }}>
          {notConnected.length} available
        </span>
      </div>

      {/* Platform grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {platforms.map((platform) => (
          <PlatformCard
            key={platform.key}
            platform={platform}
            onSend={() => setSendPlatform(platform.key)}
          />
        ))}
      </div>

      {/* Send message panel */}
      {sendPlatform && (
        <div
          className="rounded-lg p-4 mt-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.75rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
              Send via {platforms.find((p) => p.key === sendPlatform)?.label}
            </span>
            <button
              onClick={() => setSendPlatform(null)}
              className="text-[0.65rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Close
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            <input
              placeholder="Channel / recipient"
              value={sendChannel}
              onChange={(e) => setSendChannel(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md text-[0.75rem]"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.87)",
                outline: "none",
              }}
            />
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Message..."
              value={sendContent}
              onChange={(e) => setSendContent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 px-3 py-2 rounded-md text-[0.75rem]"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.87)",
                outline: "none",
              }}
            />
            <button
              onClick={handleSend}
              className="px-4 py-2 rounded-md text-[0.7rem] font-medium"
              style={{
                background: `${PLATFORM_COLORS[sendPlatform] ?? "#5eead4"}20`,
                color: PLATFORM_COLORS[sendPlatform] ?? "#5eead4",
                border: `1px solid ${PLATFORM_COLORS[sendPlatform] ?? "#5eead4"}30`,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformCard({
  platform,
  onSend,
}: {
  readonly platform: Platform;
  readonly onSend: () => void;
}) {
  const color = PLATFORM_COLORS[platform.key] ?? "#6b7280";
  const isConnected = platform.status === "connected";

  return (
    <div
      className="rounded-lg p-3 transition-all"
      style={{
        background: isConnected ? `${color}08` : "rgba(255,255,255,0.02)",
        border: isConnected ? `1px solid ${color}25` : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[1rem]">{platform.icon}</span>
        <span className="text-[0.75rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          {platform.label}
        </span>
        <span
          className="ml-auto w-2 h-2 rounded-full"
          style={{
            background: isConnected ? "#22C55E" : "#6b7280",
            boxShadow: isConnected ? "0 0 6px rgba(34,197,94,0.4)" : "none",
          }}
        />
      </div>

      {/* Status */}
      <div className="text-[0.6rem] font-mono mb-2" style={{ color: "var(--pn-text-tertiary)" }}>
        {isConnected
          ? `${platform.active_channels} active channel${platform.active_channels !== 1 ? "s" : ""}`
          : "Not connected"}
      </div>

      {/* Connections */}
      {platform.connections.length > 0 && (
        <div className="space-y-1 mb-2">
          {platform.connections.map((conn, i) => (
            <div
              key={`${conn.agent_slug}-${i}`}
              className="flex items-center gap-1.5 text-[0.6rem]"
              style={{ color: "var(--pn-text-secondary)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: conn.active ? "#22C55E" : "#6b7280" }}
              />
              <span className="font-mono">{conn.agent_name}</span>
              <span style={{ color: "var(--pn-text-muted)" }}>
                ({conn.connection_status})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {isConnected && (
        <button
          onClick={onSend}
          className="w-full py-1.5 rounded text-[0.6rem] font-mono transition-all hover:brightness-110"
          style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
        >
          Send Message
        </button>
      )}
    </div>
  );
}
