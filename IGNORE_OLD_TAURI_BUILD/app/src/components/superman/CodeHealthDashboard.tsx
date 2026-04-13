import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useProjectsStore } from "@/stores/projects-store";
import { useGapStore } from "@/stores/gap-store";
import { api } from "@/lib/api";
import { APP_CONFIGS } from "@/types/workspace";
import { openApp } from "@/lib/window-manager";
import { useWorkspaceStore } from "@/stores/workspace-store";

const config = APP_CONFIGS["code-health"];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

interface ProjectHealth {
  readonly id: string;
  readonly name: string;
  readonly path: string | null;
  readonly gapCounts: { critical: number; high: number; medium: number; low: number };
  readonly healthScore: number;
  readonly lastIndexed: string | null;
}

function computeHealthScore(gaps: { critical: number; high: number; medium: number; low: number }): number {
  const penalty = gaps.critical * 25 + gaps.high * 10 + gaps.medium * 3 + gaps.low * 1;
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function CodeHealthDashboard() {
  const [ready, setReady] = useState(false);
  const projects = useProjectsStore((s) => s.projects);
  const allGaps = useGapStore((s) => s.gaps);
  const [indexingPath, setIndexingPath] = useState("");
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    async function init() {
      await useProjectsStore.getState().loadViaRest().catch(() => {});
      await useGapStore.getState().loadViaRest().catch(() => {});
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="code-health" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  // Build per-project health data
  const projectHealthData: ProjectHealth[] = projects.map((p) => {
    const projectGaps = allGaps.filter((g) => g.project_id === p.id);
    const gapCounts = {
      critical: projectGaps.filter((g) => g.severity === "critical").length,
      high: projectGaps.filter((g) => g.severity === "high").length,
      medium: projectGaps.filter((g) => g.severity === "medium").length,
      low: projectGaps.filter((g) => g.severity === "low").length,
    };

    return {
      id: p.id,
      name: p.name,
      path: (p as unknown as Record<string, unknown>).path as string | null,
      gapCounts,
      healthScore: computeHealthScore(gapCounts),
      lastIndexed: null,
    };
  });

  // Sort by health score ascending (worst first)
  const sorted = [...projectHealthData].sort((a, b) => a.healthScore - b.healthScore);

  function handleOpenSuperman(_projectId: string) {
    const windows = useWorkspaceStore.getState().windows;
    const saved = windows.find((w) => w.app_id === "superman") ?? null;
    openApp("superman", saved);
  }

  async function handleIndex() {
    if (!indexingPath.trim()) return;
    setIndexing(true);
    try {
      await api.post("/superman/index", { repo_path: indexingPath });
      setIndexingPath("");
    } catch {
      // ignore
    }
    setIndexing(false);
  }

  return (
    <AppWindowChrome appId="code-health" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex flex-col gap-4 h-full">
        {/* Summary */}
        <div className="flex items-center gap-4">
          <div className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
            {projects.length} Projects
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {(["critical", "high", "medium", "low"] as const).map((sev) => {
              const total = allGaps.filter((g) => g.severity === sev).length;
              return (
                <span key={sev} className="text-[0.65rem] font-mono" style={{ color: SEVERITY_COLORS[sev] }}>
                  {total} {sev}
                </span>
              );
            })}
          </div>
        </div>

        {/* Project health grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {sorted.map((ph) => (
              <button
                key={ph.id}
                onClick={() => handleOpenSuperman(ph.id)}
                className="text-left rounded-lg p-4 transition-all hover:brightness-110"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Project name + health arc */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
                      {ph.name}
                    </div>
                    {ph.path && (
                      <div className="text-[0.6rem] font-mono mt-0.5" style={{ color: "var(--pn-text-muted)" }}>
                        {ph.path}
                      </div>
                    )}
                  </div>
                  <HealthGauge score={ph.healthScore} />
                </div>

                {/* Gap counts */}
                <div className="flex items-center gap-2 mb-2">
                  {(["critical", "high", "medium", "low"] as const).map((sev) => {
                    const count = ph.gapCounts[sev];
                    if (count === 0) return null;
                    return (
                      <span
                        key={sev}
                        className="text-[0.6rem] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: `${SEVERITY_COLORS[sev]}12`, color: SEVERITY_COLORS[sev] }}
                      >
                        {count} {sev}
                      </span>
                    );
                  })}
                  {Object.values(ph.gapCounts).every((c) => c === 0) && (
                    <span className="text-[0.6rem] font-mono" style={{ color: "#22C55E" }}>No gaps</span>
                  )}
                </div>

                {/* Most critical gap */}
                {ph.gapCounts.critical > 0 && (
                  <div className="text-[0.6rem] px-2 py-1 rounded" style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.8)" }}>
                    {allGaps.find((g) => g.project_id === ph.id && g.severity === "critical")?.title ?? "Critical gap"}
                  </div>
                )}
              </button>
            ))}

            {/* Index new project card */}
            <div
              className="rounded-lg p-4 flex flex-col items-center justify-center gap-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.1)",
                minHeight: "140px",
              }}
            >
              <span className="text-[1.5rem]" style={{ color: "rgba(255,255,255,0.15)" }}>+</span>
              <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>Index New Project</span>
              <div className="flex gap-1 w-full">
                <input
                  placeholder="/path/to/repo"
                  value={indexingPath}
                  onChange={(e) => setIndexingPath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleIndex()}
                  className="flex-1 px-2 py-1.5 rounded text-[0.7rem]"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.87)",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleIndex}
                  disabled={indexing}
                  className="px-3 py-1.5 rounded text-[0.65rem] font-mono"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}
                >
                  {indexing ? "..." : "Go"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppWindowChrome>
  );
}

function HealthGauge({ score }: { readonly score: number }) {
  const color = score >= 80 ? "#22C55E" : score >= 50 ? "#EAB308" : "#EF4444";
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: "52px", height: "52px" }}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={radius} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 26 26)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[0.7rem] font-bold font-mono" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}
