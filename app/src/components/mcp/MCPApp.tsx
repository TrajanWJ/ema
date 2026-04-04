import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

interface MCPTool { name: string; description: string; input_schema?: Record<string, unknown>; }

export function MCPApp() {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [selected, setSelected] = useState<MCPTool | null>(null);
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<MCPTool[]>("/mcp/tools").then(setTools).catch(() => []).finally(() => setLoading(false));
  }, []);

  const execute = () => {
    if (!selected) return;
    setRunning(true); setResult("");
    let parsedArgs: unknown = {};
    try { parsedArgs = JSON.parse(args); } catch { setResult("Invalid JSON args"); setRunning(false); return; }
    api.post<{ result: unknown }>("/mcp/tools/execute", { name: selected.name, args: parsedArgs })
      .then((r) => setResult(JSON.stringify(r.result, null, 2)))
      .catch((e) => setResult(String(e)))
      .finally(() => setRunning(false));
  };

  return (
    <AppWindowChrome appId="mcp" title="MCP Tools">
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <div style={{ width: 260, borderRight: "1px solid rgba(255,255,255,0.08)", overflowY: "auto" }}>
          {loading && <div style={{ padding: 16, opacity: 0.5, fontSize: 13 }}>Loading tools…</div>}
          {tools.map((t) => (
            <div key={t.name} onClick={() => { setSelected(t); setResult(""); setArgs("{}"); }} style={{
              padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)",
              background: selected?.name === t.name ? "rgba(6,182,212,0.1)" : "transparent",
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#67e8f9" }}>{t.name}</div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{t.description?.slice(0, 60)}</div>
            </div>
          ))}
          {tools.length === 0 && !loading && <div style={{ padding: 16, opacity: 0.5, fontSize: 12 }}>No MCP tools registered.</div>}
        </div>
        <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selected ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: "#67e8f9" }}>{selected.name}</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>{selected.description}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.7 }}>Arguments (JSON)</div>
              <textarea value={args} onChange={(e) => setArgs(e.target.value)} rows={6}
                style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 12, fontFamily: "monospace", resize: "vertical", marginBottom: 10 }} />
              <button onClick={execute} disabled={running}
                style={{ alignSelf: "flex-start", padding: "7px 20px", borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(6,182,212,0.2)", color: "#67e8f9", fontSize: 13, fontWeight: 600 }}>
                {running ? "Running…" : "Execute"}
              </button>
              {result && <pre style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.3)", fontSize: 12, overflow: "auto", flex: 1 }}>{result}</pre>}
            </>
          ) : (
            <div style={{ opacity: 0.4, fontSize: 13, margin: "auto" }}>Select a tool from the left</div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
