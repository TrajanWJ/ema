import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { useSessionsStore } from "@/stores/sessions-store";
import { navigateToRoute } from "@/lib/router";

const cfg = APP_CONFIGS["sessions"];

export function SessionsApp() {
  const { sessions, loadViaRest, selectedSessionId, selectSession } = useSessionsStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadViaRest?.().finally(() => setLoading(false));
  }, [loadViaRest]);

  const selected = sessions.find((s) => s.id === selectedSessionId) ?? null;
  const activeCount = sessions.filter((s) => s.status === "running").length;

  return (
    <AppWindowChrome appId="sessions" title={cfg.title} icon={cfg.icon} accent={cfg.accent}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Summary bar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 24, fontSize: 13 }}>
          <span>Total: <strong>{sessions.length}</strong></span>
          <span style={{ color: "#22c55e" }}>Active: <strong>{activeCount}</strong></span>
        </div>
        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left panel */}
          <div style={{ width: "30%", borderRight: "1px solid rgba(255,255,255,0.08)", overflowY: "auto" }}>
            {loading && <div style={{ padding: 16, opacity: 0.5 }}>Loading…</div>}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => selectSession(s.id)}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  background: selectedSessionId === s.id ? "rgba(255,255,255,0.07)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: s.status === "running" ? "#22c55e" : "rgba(255,255,255,0.3)",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.session_id ?? s.id}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>{s.model}</div>
                </div>
                <span style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
          {/* Right panel */}
          <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
            {selected ? (
              <div>
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{selected.session_id ?? selected.id}</div>
                    <div style={{ fontSize: 12, opacity: 0.5 }}>Model: {selected.model} · Status: {selected.status}</div>
                  </div>
                  <button
                    onClick={() => {
                      navigateToRoute("claude-bridge", {
                        searchParams: { session_id: selected.id },
                      });
                    }}
                    style={{
                      padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.5)",
                      background: "rgba(99,102,241,0.15)", color: "#a5b4fc", cursor: "pointer", fontSize: 12,
                    }}
                  >
                    Open in Claude Bridge
                  </button>
                </div>
                {/* Message list placeholder */}
                <div style={{ fontSize: 12, opacity: 0.4, marginTop: 24 }}>
                  Select a session to view details. Use Claude Bridge for full interaction.
                </div>
              </div>
            ) : (
              <div style={{ opacity: 0.4, fontSize: 13, marginTop: 40, textAlign: "center" }}>
                Select a session from the left panel
              </div>
            )}
          </div>
        </div>
      </div>
    </AppWindowChrome>
  );
}
