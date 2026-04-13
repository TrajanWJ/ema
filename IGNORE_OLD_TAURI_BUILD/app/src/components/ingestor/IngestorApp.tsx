import { useEffect, useState } from "react";
import { useIngestorStore } from "@/stores/ingestor-store";

const STATUS: Record<string, { sym: string; color: string }> = {
  pending: { sym: "●", color: "#f59e0b" },
  processing: { sym: "◌", color: "#00d2ff" },
  done: { sym: "✓", color: "#22c55e" },
  failed: { sym: "✕", color: "#ef4444" },
};
const SRC_ICON: Record<string, string> = { url: "🔗", file: "📄", text: "📝", clipboard: "📋" };

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

// Shared inline styles
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column",
};
const input: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "6px", padding: "8px 10px", color: "var(--pn-text-primary)",
  fontSize: "13px", outline: "none", fontFamily: "inherit",
};
const btn: React.CSSProperties = {
  background: "rgba(0,210,255,0.12)", border: "1px solid rgba(0,210,255,0.25)",
  borderRadius: "6px", padding: "8px 14px", color: "#00d2ff", fontSize: "13px", cursor: "pointer", fontWeight: 500,
};
const label: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "var(--pn-text-muted)", marginBottom: "8px",
};
const muted13: React.CSSProperties = { color: "var(--pn-text-muted)", fontSize: "13px" };
const border06 = "1px solid rgba(255,255,255,0.06)";

export function IngestorApp() {
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const { jobs, loading, selectedJob } = useIngestorStore();
  const loadJobs = useIngestorStore((s) => s.loadJobs);
  const createJob = useIngestorStore((s) => s.createJob);
  const selectJob = useIngestorStore((s) => s.selectJob);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const submit = (type: string, val: string, clear: () => void) => {
    const t = val.trim();
    if (!t) return;
    createJob(type, t);
    clear();
  };

  const active = jobs.filter((j) => j.status === "pending" || j.status === "processing");
  const done = jobs.filter((j) => j.status === "done" || j.status === "failed");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(8,9,14,0.95)", color: "var(--pn-text-primary)", fontFamily: "system-ui, sans-serif" }}>
      <div data-tauri-drag-region style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, color: "var(--pn-text-secondary)", borderBottom: border06, userSelect: "none" }}>
        Knowledge Ingestor
      </div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: inputs + queue */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", padding: "16px", gap: "16px" }}>
          <div style={card}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input type="text" placeholder="Paste a URL to ingest…" value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit("url", urlInput, () => setUrlInput(""))}
                style={input} />
              <button onClick={() => submit("url", urlInput, () => setUrlInput(""))} disabled={!urlInput.trim()} style={btn}>Ingest</button>
            </div>
            <textarea placeholder="Paste text to capture…" value={textInput}
              onChange={(e) => setTextInput(e.target.value)} rows={3}
              style={{ ...input, resize: "vertical", minHeight: "60px" }} />
            <button onClick={() => submit("text", textInput, () => setTextInput(""))}
              disabled={!textInput.trim()} style={{ ...btn, marginTop: "8px", alignSelf: "flex-end" }}>Capture</button>
            <div style={{ marginTop: "10px", border: "1.5px dashed rgba(0,210,255,0.2)", borderRadius: "8px", padding: "18px", textAlign: "center", ...muted13 }}>
              Drop files here
            </div>
          </div>

          {active.length > 0 && (
            <div style={card}>
              <div style={label}>Queue ({active.length})</div>
              {active.map((j) => <JobRow key={j.id} job={j} selected={selectedJob?.id === j.id} onSelect={() => selectJob(j)} />)}
            </div>
          )}

          <div style={card}>
            <div style={label}>History ({done.length})</div>
            {loading && jobs.length === 0 && <div style={muted13}>Loading…</div>}
            {!loading && done.length === 0 && <div style={muted13}>No ingestions yet</div>}
            {done.map((j) => <JobRow key={j.id} job={j} selected={selectedJob?.id === j.id} onSelect={() => selectJob(j)} />)}
          </div>
        </div>

        {/* Right: preview */}
        <div style={{ width: "320px", borderLeft: border06, padding: "16px", overflow: "auto" }}>
          {selectedJob ? <Preview job={selectedJob} /> : (
            <div style={{ ...muted13, marginTop: "40px", textAlign: "center" }}>Select a job to preview</div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobRow({ job, selected, onSelect }: {
  job: { id: number; source_type: string; source_uri: string; status: string; inserted_at: string };
  selected: boolean; onSelect: () => void;
}) {
  const st = STATUS[job.status] ?? STATUS.pending;
  return (
    <div onClick={onSelect} style={{
      display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px",
      borderRadius: "6px", cursor: "pointer", fontSize: "13px",
      background: selected ? "rgba(255,255,255,0.06)" : "transparent",
    }}>
      <span style={{ fontSize: "14px" }}>{SRC_ICON[job.source_type] ?? "📦"}</span>
      <span style={{ color: st.color, fontSize: "10px", animation: job.status === "processing" ? "spin 1s linear infinite" : undefined }}>{st.sym}</span>
      <span style={{ flex: 1, color: "var(--pn-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {trunc(job.source_uri, 48)}
      </span>
      <span style={{ color: "var(--pn-text-muted)", fontSize: "11px", flexShrink: 0 }}>{fmtTime(job.inserted_at)}</span>
    </div>
  );
}

function Preview({ job }: {
  job: { status: string; extracted_title: string | null; extracted_summary: string | null; extracted_tags: readonly string[]; vault_path: string | null };
}) {
  if (job.status === "pending" || job.status === "processing") {
    return <div style={{ ...muted13, marginTop: "40px", textAlign: "center" }}>Processing…</div>;
  }
  const badge: React.CSSProperties = {
    background: "rgba(0,210,255,0.1)", border: "1px solid rgba(0,210,255,0.2)",
    borderRadius: "4px", padding: "2px 8px", fontSize: "11px", color: "#00d2ff",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ fontSize: "15px", fontWeight: 600 }}>{job.extracted_title ?? "Untitled"}</div>
      {job.extracted_summary && (
        <p style={{ fontSize: "13px", color: "var(--pn-text-secondary)", lineHeight: 1.5, margin: 0 }}>{job.extracted_summary}</p>
      )}
      {job.extracted_tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {job.extracted_tags.map((tag) => <span key={tag} style={badge}>{tag}</span>)}
        </div>
      )}
      {job.vault_path && <div style={{ fontSize: "12px", color: "var(--pn-text-muted)" }}>Vault: {job.vault_path}</div>}
    </div>
  );
}
