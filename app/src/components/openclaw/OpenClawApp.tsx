import { useEffect, useState } from "react";
import { useOpenClawStore } from "@/stores/openclaw-store";

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 8,
        height: 8,
        background: connected ? "#22C55E" : "#EF4444",
        boxShadow: connected ? "0 0 6px #22C55E" : "0 0 6px #EF4444",
      }}
    />
  );
}

function SessionRow({ session }: { session: { id: string; agent_type?: string; status?: string; created_at?: string } }) {
  return (
    <div className="glass-surface rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs" style={{ color: "var(--pn-text-secondary)" }}>
          {session.id.slice(0, 12)}
        </span>
        {session.agent_type && (
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
            {session.agent_type}
          </span>
        )}
      </div>
      <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>
        {session.status ?? "unknown"}
      </span>
    </div>
  );
}

export function OpenClawApp() {
  const { status, sessions, loading, loadViaRest, connect, sendMessage, dispatch } = useOpenClawStore();
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [agentType, setAgentType] = useState("general");

  useEffect(() => {
    loadViaRest();
    connect();
  }, [loadViaRest, connect]);

  async function handleSend() {
    if (!sessionId.trim() || !message.trim()) return;
    await sendMessage(sessionId, message);
    setMessage("");
  }

  async function handleDispatch() {
    if (!agentType.trim()) return;
    await dispatch(agentType);
    await loadViaRest();
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: "rgba(255,255,255,0.87)" }}>
          OpenClaw Gateway
        </h1>
        <div className="flex items-center gap-2">
          <StatusDot connected={status.connected} />
          <span className="text-xs" style={{ color: "var(--pn-text-secondary)" }}>
            {status.connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {status.error && (
        <div className="glass-surface rounded-lg px-4 py-2 text-xs" style={{ color: "#EF4444", borderLeft: "2px solid #EF4444" }}>
          {status.error}
        </div>
      )}

      {/* Dispatch Agent */}
      <div className="glass-surface rounded-lg p-4">
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
          Dispatch Agent
        </h2>
        <div className="flex gap-2">
          <input
            value={agentType}
            onChange={(e) => setAgentType(e.target.value)}
            placeholder="Agent type..."
            className="flex-1 bg-transparent border rounded px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--pn-border-default)", color: "rgba(255,255,255,0.87)" }}
          />
          <button
            onClick={handleDispatch}
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa" }}
          >
            Spawn
          </button>
        </div>
      </div>

      {/* Send Message */}
      <div className="glass-surface rounded-lg p-4">
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
          Send Message
        </h2>
        <div className="flex flex-col gap-2">
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Session ID..."
            className="bg-transparent border rounded px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--pn-border-default)", color: "rgba(255,255,255,0.87)" }}
          />
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message..."
              className="flex-1 bg-transparent border rounded px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--pn-border-default)", color: "rgba(255,255,255,0.87)" }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ background: "rgba(107,149,240,0.2)", color: "#6b95f0" }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
          Sessions {loading ? "(loading...)" : `(${sessions.length})`}
        </h2>
        <div className="flex flex-col gap-2">
          {sessions.length === 0 ? (
            <div className="text-xs text-center py-8" style={{ color: "var(--pn-text-muted)" }}>
              No active OpenClaw sessions
            </div>
          ) : (
            sessions.map((s) => <SessionRow key={s.id} session={s} />)
          )}
        </div>
      </div>
    </div>
  );
}
