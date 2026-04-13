import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useSecurityStore } from "@/stores/security-store";
import { APP_CONFIGS } from "@/types/workspace";

function ScoreRing({ score, max }: { score: number; max: number }) {
  const percent = max > 0 ? Math.round((score / max) * 100) : 0;
  const color = percent >= 80 ? "#22C55E" : percent >= 60 ? "#f59e0b" : "#EF4444";
  const circumference = 2 * Math.PI * 40;
  const strokeDash = (percent / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold font-mono" style={{ color }}>{percent}</div>
        <div className="text-[0.5rem]" style={{ color: "var(--pn-text-muted)" }}>/ 100</div>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: { id: string; name: string; passed: boolean; points: number; max_points: number; fix_guide: string } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-surface rounded-lg overflow-hidden">
      <button
        onClick={() => !check.passed && setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center rounded-full text-xs font-bold"
            style={{
              width: 24,
              height: 24,
              background: check.passed ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: check.passed ? "#22C55E" : "#EF4444",
            }}
          >
            {check.passed ? "\u2713" : "\u2717"}
          </span>
          <span className="text-xs" style={{ color: "var(--pn-text-secondary)" }}>
            {check.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: check.passed ? "#22C55E" : "var(--pn-text-muted)" }}>
            +{check.points}/{check.max_points}
          </span>
          {!check.passed && (
            <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
              {expanded ? "\u25B2" : "\u25BC"}
            </span>
          )}
        </div>
      </button>
      {expanded && !check.passed && (
        <div
          className="px-4 pb-3 text-xs"
          style={{ color: "var(--pn-text-tertiary)", borderTop: "1px solid var(--pn-border-subtle)" }}
        >
          <div className="pt-2 font-medium mb-1" style={{ color: "#f59e0b" }}>Fix Guide:</div>
          {check.fix_guide}
        </div>
      )}
    </div>
  );
}

function WarningCard({ warning }: { warning: { id: string; severity: string; title: string; description: string; mitigation: string } }) {
  const [expanded, setExpanded] = useState(false);
  const severityColor = warning.severity === "high" ? "#EF4444" : warning.severity === "medium" ? "#f59e0b" : "var(--pn-text-tertiary)";

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: `${severityColor}10`, borderLeft: `3px solid ${severityColor}` }}
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: `${severityColor}20`, color: severityColor }}>
              {warning.severity.toUpperCase()}
            </span>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
              {warning.title}
            </span>
          </div>
          <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 text-xs" style={{ color: "var(--pn-text-secondary)" }}>
          <p className="mb-2">{warning.description}</p>
          <p style={{ color: "#2dd4a8" }}>
            <strong>Mitigation:</strong> {warning.mitigation}
          </p>
        </div>
      )}
    </div>
  );
}

const secConfig = APP_CONFIGS["security"];

export function SecurityPanelApp() {
  const { posture, auditing, loadPosture, runAudit } = useSecurityStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      await loadPosture().catch(() => {});
      setReady(true);
    }
    init();
  }, [loadPosture]);

  if (!ready) {
    return (
      <AppWindowChrome appId="security" title={secConfig.title} icon={secConfig.icon} accent={secConfig.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-sm" style={{ color: "var(--pn-text-secondary)" }}>Running security checks...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const p = posture;
  const checks = p?.checks ?? [];
  const warnings = p?.supply_chain_warnings ?? [];
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  return (
    <AppWindowChrome appId="security" title={secConfig.title} icon={secConfig.icon} accent={secConfig.accent}>
      <div className="flex flex-col gap-4 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold" style={{ color: "rgba(255,255,255,0.87)" }}>
            Security Posture
          </h1>
          <button
            onClick={runAudit}
            disabled={auditing}
            className="text-xs px-3 py-1.5 rounded transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
          >
            {auditing ? "Auditing..." : "Run Security Audit"}
          </button>
        </div>

        {/* Score + summary */}
        <div className="glass-surface rounded-lg p-4 flex items-center gap-6">
          <ScoreRing score={p?.score ?? 0} max={p?.max_score ?? 100} />
          <div className="flex-1">
            <div className="text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.87)" }}>
              {(p?.percent ?? 0) >= 80 ? "Good posture" : (p?.percent ?? 0) >= 60 ? "Needs attention" : "At risk"}
            </div>
            <div className="flex gap-4 text-xs">
              <span style={{ color: "#22C55E" }}>{passed} passed</span>
              <span style={{ color: "#EF4444" }}>{failed} failed</span>
            </div>
            {p?.audited_at && (
              <div className="text-[0.6rem] mt-2" style={{ color: "var(--pn-text-muted)" }}>
                Last check: {new Date(p.audited_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Checks */}
        <div>
          <h2 className="text-xs font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
            Security Checks ({passed}/{checks.length})
          </h2>
          <div className="flex flex-col gap-2">
            {checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
        </div>

        {/* Supply chain warnings */}
        {warnings.length > 0 && (
          <div>
            <h2 className="text-xs font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
              Supply Chain Alerts
            </h2>
            <div className="flex flex-col gap-2">
              {warnings.map((w) => (
                <WarningCard key={w.id} warning={w} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
