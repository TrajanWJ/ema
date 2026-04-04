import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

interface DBTable { name: string; row_count: number; size_mb: number; }
interface DBStats { tables: DBTable[]; total_size_mb: number; last_backup_at: string | null; }

export function PersistenceApp() {
  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get<DBStats>("/persistence/stats").then(setStats).catch(() => null).finally(() => setLoading(false));
  }, []);

  const backup = () => {
    setBacking(true); setMsg("");
    api.post("/persistence/backup", {})
      .then(() => setMsg("Backup started successfully"))
      .catch(() => setMsg("Backup failed"))
      .finally(() => setBacking(false));
  };

  return (
    <AppWindowChrome appId="persistence" title="Persistence">
      <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
        {loading && <div style={{ opacity: 0.5, fontSize: 13 }}>Loading…</div>}
        {stats && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total_size_mb} MB</div>
                <div style={{ fontSize: 12, opacity: 0.5 }}>Total DB Size</div>
              </div>
              <div style={{ flex: 1, padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.tables?.length ?? 0}</div>
                <div style={{ fontSize: 12, opacity: 0.5 }}>Tables</div>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: 0.7 }}>Tables</div>
              {stats.tables?.map((t) => (
                <div key={t.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                  <span>{t.name}</span>
                  <span style={{ opacity: 0.5 }}>{t.row_count?.toLocaleString()} rows · {t.size_mb} MB</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={backup} disabled={backing}
                style={{ padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", fontSize: 13, fontWeight: 600 }}>
                {backing ? "Backing up…" : "Backup Now"}
              </button>
              {stats.last_backup_at && <span style={{ fontSize: 12, opacity: 0.5 }}>Last: {new Date(stats.last_backup_at).toLocaleString()}</span>}
              {msg && <span style={{ fontSize: 12, color: "#22c55e" }}>{msg}</span>}
            </div>
          </>
        )}
        {!loading && !stats && <div style={{ opacity: 0.5, fontSize: 13 }}>Persistence stats unavailable.</div>}
      </div>
    </AppWindowChrome>
  );
}
