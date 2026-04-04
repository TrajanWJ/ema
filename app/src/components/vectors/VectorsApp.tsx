import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

interface VectorResult { id: string; title: string; snippet: string; score: number; source_type: string; }
interface VectorStats { total_documents: number; index_size_mb: number; last_updated: string; }

export function VectorsApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VectorResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [tab, setTab] = useState<"search" | "stats">("search");
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    api.get<VectorStats>("/vectors/stats").then(setStats).catch(() => null);
  }, []);

  const search = () => {
    if (!query.trim()) return;
    setSearching(true);
    api.get<VectorResult[]>(`/vectors/search?q=${encodeURIComponent(query)}`)
      .then(setResults).catch(() => []).finally(() => setSearching(false));
  };

  const reindex = () => {
    setReindexing(true);
    api.post("/vectors/index", {}).finally(() => setReindexing(false));
  };

  return (
    <AppWindowChrome appId="vectors" title="Knowledge Search">
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 2, padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {(["search", "stats"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
              background: tab === t ? "rgba(167,139,250,0.2)" : "transparent",
              color: tab === t ? "#c4b5fd" : "rgba(255,255,255,0.55)",
            }}>{t === "search" ? "Search" : "Stats"}</button>
          ))}
        </div>
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {tab === "search" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search your knowledge base…"
                  style={{ flex: 1, padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 13 }} />
                <button onClick={search} disabled={searching}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(167,139,250,0.2)", color: "#c4b5fd", fontSize: 13, fontWeight: 600 }}>
                  {searching ? "…" : "Search"}
                </button>
              </div>
              {results.map((r) => (
                <div key={r.id} style={{ marginBottom: 14, padding: 14, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</span>
                    <span style={{ fontSize: 11, color: "#a78bfa" }}>{Math.round(r.score * 100)}% · {r.source_type}</span>
                  </div>
                  <p style={{ fontSize: 12, opacity: 0.65, margin: 0 }}>{r.snippet}</p>
                </div>
              ))}
              {results.length === 0 && query && !searching && <div style={{ opacity: 0.5, fontSize: 13 }}>No results found.</div>}
            </div>
          )}
          {tab === "stats" && (
            <div>
              {stats ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_documents?.toLocaleString()}</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>Indexed Documents</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.index_size_mb} MB</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>Index Size</div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>Last updated: {stats.last_updated}</div>
                  <button onClick={reindex} disabled={reindexing}
                    style={{ alignSelf: "flex-start", padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(167,139,250,0.2)", color: "#c4b5fd", fontSize: 12 }}>
                    {reindexing ? "Re-indexing…" : "Re-index All"}
                  </button>
                </div>
              ) : <div style={{ opacity: 0.5, fontSize: 13 }}>Loading stats…</div>}
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
