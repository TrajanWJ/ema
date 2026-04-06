import { useEffect, useState } from "react";
import * as hq from "../../api/hq";
import { useProjectStore } from "../../store/projectStore";

export function BrainDumpWidget() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [content, setContent] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const result = await hq.getBrainDump({ status: "unprocessed", projectId: activeProjectId || undefined });
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void load();
  }, [activeProjectId]);

  async function submit() {
    if (!content.trim()) return;
    try {
      await hq.addBrainDumpItem({ content, projectId: activeProjectId || undefined });
      setContent("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="card-list">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
        }}
        placeholder="What's on your mind? (Cmd+Enter to save)"
      />
      <button onClick={() => void submit()}>Save Brain Dump</button>
      {error && <div style={{ color: "var(--red)" }}>{error}</div>}
      <div className="card-list">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.content}</div>
            <div className="row-between" style={{ marginTop: 8 }}>
              <span className="muted">{timeAgo(item.created_at)}</span>
              <div className="row">
                <button
                  onClick={async () => {
                    await hq.dispatchExecution({
                      title: "Brain dump follow-up",
                      instruction: item.content,
                      projectId: item.project_id || undefined
                    });
                  }}
                >
                  → Agent
                </button>
                <button onClick={async () => { await hq.updateBrainDumpItem(item.id, { status: "processed", project_id: item.project_id }); await load(); }}>
                  ✓ Done
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(ts?: number) {
  if (!ts) return "now";
  const delta = Math.max(1, Math.floor(Date.now() / 1000 - ts));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}
