import { useState } from "react";
import { useChannelsStore } from "@/stores/channels-store";

const CONNECTION_COLORS: Record<string, string> = {
  connected: "#23a55a",
  degraded: "#f0b232",
  connecting: "#f0b232",
  disconnected: "#f23f43",
};

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{ position: "absolute", left: "56px", top: "50%", transform: "translateY(-50%)", background: "rgba(14,16,23,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "6px 10px", whiteSpace: "nowrap", zIndex: 50, fontSize: "0.75rem", color: "rgba(255,255,255,0.9)", fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
          {text}
        </div>
      )}
    </div>
  );
}

export function ServerList() {
  const servers = useChannelsStore((s) => s.servers);
  const activeServerId = useChannelsStore((s) => s.activeServerId);
  const setActiveServer = useChannelsStore((s) => s.setActiveServer);
  const viewMode = useChannelsStore((s) => s.viewMode);
  const setViewMode = useChannelsStore((s) => s.setViewMode);
  const [hovered, setHovered] = useState<string | null>(null);

  const systemServers = servers.filter((s) => s.id === "ema");
  const agentServers = servers.filter((s) => s.id !== "ema");

  function renderServer(server: typeof servers[0]) {
    const active = server.id === activeServerId && viewMode === "channels";
    const isHovered = hovered === server.id;
    const statusColor = CONNECTION_COLORS[server.connectionStatus ?? "disconnected"] ?? CONNECTION_COLORS.disconnected;

    return (
      <Tooltip key={server.id} text={server.name}>
        <div style={{ position: "relative" }}>
          {active && (
            <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "4px", height: "36px", background: "rgba(255,255,255,0.9)", borderRadius: "0 4px 4px 0" }} />
          )}
          {/* Unread badge */}
          {server.unreadTotal != null && server.unreadTotal > 0 && (
            <span style={{ position: "absolute", top: "-2px", right: "4px", background: "#ed4245", color: "#fff", fontSize: "0.55rem", fontWeight: 700, borderRadius: "8px", padding: "1px 4px", minWidth: "14px", textAlign: "center", zIndex: 2, lineHeight: "14px" }}>
              {server.unreadTotal > 99 ? "99+" : server.unreadTotal}
            </span>
          )}
          <button
            onClick={() => { setActiveServer(server.id); if (viewMode !== "channels") setViewMode("channels"); }}
            onMouseEnter={() => setHovered(server.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: "44px", height: "44px",
              borderRadius: active || isHovered ? "12px" : "22px",
              background: active ? "rgba(88,101,242,0.8)" : isHovered ? "rgba(88,101,242,0.5)" : "rgba(255,255,255,0.06)",
              backdropFilter: "blur(8px)",
              border: `1px solid ${active ? "rgba(88,101,242,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: active || isHovered ? "#fff" : "rgba(255,255,255,0.5)",
              fontSize: "1.2rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.15s",
              position: "relative",
            }}
          >
            {server.icon}
            {/* Connection status dot */}
            <span style={{ position: "absolute", bottom: "-1px", right: "-1px", width: "10px", height: "10px", borderRadius: "50%", background: statusColor, border: "2px solid rgba(14,16,23,0.9)" }} />
          </button>
        </div>
      </Tooltip>
    );
  }

  const inboxActive = viewMode === "inbox";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "12px", paddingBottom: "12px", gap: "8px", flexShrink: 0, width: "68px", background: "rgba(14,16,23,0.55)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Inbox button */}
      <Tooltip text="Unified Inbox">
        <button
          onClick={() => setViewMode("inbox")}
          onMouseEnter={() => setHovered("inbox")}
          onMouseLeave={() => setHovered(null)}
          style={{
            width: "44px", height: "44px",
            borderRadius: inboxActive || hovered === "inbox" ? "12px" : "22px",
            background: inboxActive ? "rgba(88,101,242,0.8)" : hovered === "inbox" ? "rgba(88,101,242,0.5)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${inboxActive ? "rgba(88,101,242,0.4)" : "rgba(255,255,255,0.08)"}`,
            color: inboxActive ? "#fff" : "rgba(255,255,255,0.5)",
            fontSize: "1.1rem",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          📥
        </button>
      </Tooltip>

      <div style={{ width: "32px", height: "1px", background: "rgba(255,255,255,0.08)" }} />

      {/* System servers */}
      {systemServers.map(renderServer)}

      {agentServers.length > 0 && (
        <div style={{ width: "32px", height: "1px", background: "rgba(255,255,255,0.08)" }} />
      )}

      {/* Agent servers */}
      {agentServers.map(renderServer)}

      <div style={{ width: "32px", height: "1px", background: "rgba(255,255,255,0.08)" }} />

      {/* Add server */}
      <Tooltip text="Add Server">
        <button
          onMouseEnter={() => setHovered("add")}
          onMouseLeave={() => setHovered(null)}
          style={{
            width: "44px", height: "44px",
            borderRadius: hovered === "add" ? "12px" : "22px",
            background: "rgba(255,255,255,0.04)",
            border: `1px dashed ${hovered === "add" ? "rgba(87,242,135,0.3)" : "rgba(255,255,255,0.12)"}`,
            color: hovered === "add" ? "#57f287" : "rgba(255,255,255,0.3)",
            fontSize: "1.2rem",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          +
        </button>
      </Tooltip>
    </div>
  );
}
