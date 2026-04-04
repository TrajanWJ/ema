import { useEffect, useState, type FormEvent } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

interface Session {
  id: string;
  session_id: string;
  project_path: string;
  status: string;
  token_count: number | null;
  inserted_at: string;
}

export function AgentBridgeApp() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [dispatching, setDispatching] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = () => {
    setLoading(true);
    api.get<Session[]>("/claude/sessions")
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSessions(); }, []);

  const dispatch = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setDispatching(true);
    setResult(null);
    api.post<{ id: string }>("/executions", { title: prompt.trim(), mode: "implement" })
      .then((res) => {
        setResult(`Dispatched execution ${res.id}`);
        setPrompt("");
      })
      .catch((err: unknown) => setResult(`Error: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setDispatching(false));
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.5, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>{title}</div>
      {children}
    </div>
  );

  return (
    <AppWindowChrome appId="agent-bridge" title="Agent Bridge" icon="⚡" accent="#a78bfa">
      <div style={{ padding: "16px 20px", overflowY: "auto", height: "100%" }}>
        <Section title="Dispatch Execution">
          <form onSubmit={dispatch} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the task to execute..."
              rows={3}
              style={{
                width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.87)", fontSize: 13,
                fontFamily: "system-ui", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", fontSize: 12,
                }}
              >
                <option value="claude-sonnet-4-20250514">Sonnet 4</option>
                <option value="claude-opus-4-20250514">Opus 4</option>
                <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
              </select>
              <button type="submit" disabled={dispatching || !prompt.trim()}
                style={{
                  padding: "7px 20px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: dispatching ? "rgba(167,139,250,0.2)" : "#a78bfa",
                  color: "#fff", fontSize: 13, fontWeight: 600,
                }}>
                {dispatching ? "Dispatching..." : "Dispatch"}
              </button>
            </div>
            {result && (
              <div style={{ fontSize: 12, padding: 8, borderRadius: 6, background: "rgba(255,255,255,0.05)", color: result.startsWith("Error") ? "#ef4444" : "#2dd4a8" }}>
                {result}
              </div>
            )}
          </form>
        </Section>

        <Section title="Claude Sessions">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={loadSessions} disabled={loading}
              style={{ padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {sessions.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.4 }}>No sessions found.</div>
          ) : sessions.slice(0, 20).map((s) => (
            <div key={s.id} style={{ display: "flex", gap: 8, padding: "8px 10px", marginBottom: 4, borderRadius: 6, background: "rgba(255,255,255,0.03)", fontSize: 12 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                background: s.status === "active" ? "#22c55e" : "rgba(255,255,255,0.2)",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.project_path}
                </div>
                <div style={{ opacity: 0.4, fontSize: 11 }}>
                  {s.status}{s.token_count != null ? ` · ${s.token_count.toLocaleString()} tokens` : ""}
                </div>
              </div>
            </div>
          ))}
        </Section>
      </div>
    </AppWindowChrome>
  );
}
