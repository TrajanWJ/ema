import { useEffect, useState } from "react";
import * as superman from "../../api/superman";
import { useProjectStore } from "../../store/projectStore";

export function SupermanWidget() {
  const activeProject = useProjectStore((state) => state.activeProjectContext?.project || null);
  const [health, setHealth] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    if (!activeProject?.path) return;
    let cancelled = false;
    void Promise.all([
      superman.getHealth(activeProject.path).catch(() => null),
      superman.getGaps(activeProject.path).catch(() => [])
    ]).then(([healthResult, gapsResult]) => {
      if (cancelled) return;
      setHealth(healthResult);
      setGaps(Array.isArray(gapsResult) ? gapsResult : []);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject?.path]);

  if (!activeProject?.path) {
    return <div className="muted">Select a project with a path to enable Superman</div>;
  }

  const score = Number(health?.score || health?.healthScore || 0);
  const scoreColor = score > 80 ? "var(--green)" : score > 60 ? "var(--yellow)" : "var(--red)";

  return (
    <div className="card-list">
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div className="muted">Code Health</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: scoreColor }}>{score || "--"}</div>
      </div>

      <div className="card-list">
        {gaps.slice(0, 3).map((gap, index) => {
          const confidence = Math.round(Number(gap.confidence || 0) * 100);
          return (
            <div key={index} className="card">
              <div>{String(gap.description || gap.title || "Gap")}</div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, marginTop: 8 }}>
                <div style={{ width: `${confidence}%`, height: "100%", background: "var(--yellow)", borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask Superman about this codebase" />
        <button
          onClick={async () => {
            setLoading(true);
            try {
              const result = await superman.queryCode(query, activeProject.path || undefined);
              setAnswer(JSON.stringify(result, null, 2));
            } catch (error) {
              setAnswer(error instanceof Error ? error.message : String(error));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "..." : "Ask"}
        </button>
      </div>

      <button
        onClick={async () => {
          if (!activeProject.path) return;
          setIndexing(true);
          try {
            await superman.indexRepo(activeProject.path);
          } finally {
            setIndexing(false);
          }
        }}
      >
        {indexing ? "Indexing..." : "Index Repo"}
      </button>

      {answer && (
        <pre className="card" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{answer}</pre>
      )}
    </div>
  );
}
