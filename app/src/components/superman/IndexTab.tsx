import { useState } from "react";
import { useSupermanStore } from "@/stores/superman-store";
import { useProjectsStore } from "@/stores/projects-store";

export function IndexTab() {
  const projects = useProjectsStore((s) => s.projects);
  const indexing = useSupermanStore((s) => s.indexing);
  const projectInfo = useSupermanStore((s) => s.projectInfo);
  const serverStatus = useSupermanStore((s) => s.serverStatus);
  const indexProject = useSupermanStore((s) => s.indexProject);
  const indexPath = useSupermanStore((s) => s.indexPath);
  const checkHealth = useSupermanStore((s) => s.checkHealth);
  const panels = useSupermanStore((s) => s.panels);
  const loadPanels = useSupermanStore((s) => s.loadPanels);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [customPath, setCustomPath] = useState("");

  const projectsWithPath = projects.filter((p) => p.linked_path);

  async function handleIndex() {
    if (selectedProjectId) {
      await indexProject(selectedProjectId);
    } else if (customPath.trim()) {
      await indexPath(customPath.trim());
    }
    await loadPanels();
  }

  const info = projectInfo as Record<string, unknown> | null;
  const panelData = panels as {
    overallCompleteness?: number;
    features?: unknown[];
    bugs?: unknown[];
    loadingPhase?: string;
  } | null;

  return (
    <div className="flex flex-col gap-4">
      {/* Server status */}
      <div
        className="glass-surface rounded-lg p-3 flex items-center justify-between"
        style={{ border: "1px solid var(--pn-border-subtle)" }}
      >
        <div>
          <div className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
            Superman Server
          </div>
          <div className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            localhost:3000
          </div>
        </div>
        <button
          onClick={checkHealth}
          className="px-3 py-1 rounded text-[0.65rem] transition-colors hover:bg-white/5"
          style={{ border: "1px solid var(--pn-border-default)", color: "var(--pn-text-secondary)" }}
        >
          {serverStatus === "connected" ? "Connected" : "Reconnect"}
        </button>
      </div>

      {/* Project selector */}
      <div className="flex flex-col gap-2">
        <label className="text-[0.7rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
          Select Project
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => {
            setSelectedProjectId(e.target.value);
            setCustomPath("");
          }}
          className="glass-surface rounded px-3 py-2 text-[0.75rem]"
          style={{
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <option value="">-- Choose a project --</option>
          {projectsWithPath.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.linked_path})
            </option>
          ))}
        </select>

        <div className="text-[0.6rem] text-center" style={{ color: "var(--pn-text-muted)" }}>
          OR
        </div>

        <input
          type="text"
          value={customPath}
          onChange={(e) => {
            setCustomPath(e.target.value);
            setSelectedProjectId("");
          }}
          placeholder="/path/to/repo"
          className="glass-surface rounded px-3 py-2 text-[0.75rem]"
          style={{
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            background: "rgba(255,255,255,0.03)",
          }}
        />
      </div>

      {/* Index button */}
      <button
        onClick={handleIndex}
        disabled={indexing || (!selectedProjectId && !customPath.trim())}
        className="rounded-lg px-4 py-2.5 text-[0.8rem] font-medium transition-all duration-200 active:scale-[0.98]"
        style={{
          background: indexing ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.8)",
          color: "#fff",
          opacity: !selectedProjectId && !customPath.trim() ? 0.4 : 1,
        }}
      >
        {indexing ? "Indexing..." : "Index Project"}
      </button>

      {/* Result info */}
      {info && (
        <div
          className="glass-surface rounded-lg p-3"
          style={{ border: "1px solid var(--pn-border-subtle)" }}
        >
          <div className="text-[0.7rem] font-medium mb-2" style={{ color: "#6366f1" }}>
            Index Result
          </div>
          <div className="grid grid-cols-3 gap-2">
            {info.files !== undefined && (
              <StatCard label="Files" value={String(info.files)} />
            )}
            {info.filesProcessed !== undefined && (
              <StatCard label="Files" value={String(info.filesProcessed)} />
            )}
            {info.nodesCreated !== undefined && (
              <StatCard label="Nodes" value={String(info.nodesCreated)} />
            )}
            {info.edgesCreated !== undefined && (
              <StatCard label="Edges" value={String(info.edgesCreated)} />
            )}
            {info.nodes !== undefined && (
              <StatCard label="Nodes" value={String(info.nodes)} />
            )}
          </div>
        </div>
      )}

      {/* Panels / completeness */}
      {panelData && (
        <div
          className="glass-surface rounded-lg p-3"
          style={{ border: "1px solid var(--pn-border-subtle)" }}
        >
          <div className="text-[0.7rem] font-medium mb-2" style={{ color: "#6366f1" }}>
            Project Health
          </div>
          <div className="flex items-center gap-3">
            <HealthGauge score={Math.round((panelData.overallCompleteness ?? 0) * 100)} />
            <div className="flex flex-col gap-1">
              <div className="text-[0.65rem]" style={{ color: "var(--pn-text-secondary)" }}>
                Features: {panelData.features?.length ?? 0}
              </div>
              <div className="text-[0.65rem]" style={{ color: "var(--pn-text-secondary)" }}>
                Bugs: {panelData.bugs?.length ?? 0}
              </div>
              {panelData.loadingPhase && (
                <div className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                  Phase: {panelData.loadingPhase}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="text-center p-2 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="text-[1rem] font-semibold" style={{ color: "#6366f1" }}>
        {value}
      </div>
      <div className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
        {label}
      </div>
    </div>
  );
}

function HealthGauge({ score }: { readonly score: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22C55E" : score >= 50 ? "#EAB308" : "#EF4444";

  return (
    <div className="relative" style={{ width: 80, height: 80 }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="5"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[0.9rem] font-bold"
        style={{ color }}
      >
        {score}%
      </div>
    </div>
  );
}
