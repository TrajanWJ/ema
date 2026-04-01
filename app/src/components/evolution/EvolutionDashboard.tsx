import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useEvolutionStore } from "@/stores/evolution-store";
import { RuleEditor } from "./RuleEditor";
import { RollbackDialog } from "./RollbackDialog";
import type { BehaviorRule } from "@/types/evolution";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.evolution;

type Tab = "rules" | "signals" | "stats";

const TAB_OPTIONS = [
  { value: "rules" as const, label: "Rules" },
  { value: "signals" as const, label: "Signals" },
  { value: "stats" as const, label: "Stats" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  proposed: "#f59e0b",
  rolled_back: "#ef4444",
};

export function EvolutionDashboard() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rules");
  const [editingRule, setEditingRule] = useState<BehaviorRule | null>(null);
  const [rollbackRule, setRollbackRule] = useState<BehaviorRule | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const store = useEvolutionStore.getState();
        await Promise.all([store.loadRules(), store.loadSignals(), store.loadStats()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
      if (!cancelled) setReady(true);
      useEvolutionStore.getState().connect().catch(() => {
        console.warn("Evolution WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="evolution" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="evolution" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={tab}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[0.9rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            Evolution
          </h2>
          <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
        </div>
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {error}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "rules" && (
            <RulesTab
              statusFilter={statusFilter}
              onFilterChange={setStatusFilter}
              onEdit={setEditingRule}
              onRollback={setRollbackRule}
            />
          )}
          {tab === "signals" && <SignalsTab />}
          {tab === "stats" && <StatsTab />}
        </div>
      </div>

      {editingRule && (
        <RuleEditor rule={editingRule} onClose={() => setEditingRule(null)} />
      )}
      {rollbackRule && (
        <RollbackDialog rule={rollbackRule} onClose={() => setRollbackRule(null)} />
      )}
    </AppWindowChrome>
  );
}

function RulesTab({
  statusFilter,
  onFilterChange,
  onEdit,
  onRollback,
}: {
  readonly statusFilter: string | null;
  readonly onFilterChange: (f: string | null) => void;
  readonly onEdit: (r: BehaviorRule) => void;
  readonly onRollback: (r: BehaviorRule) => void;
}) {
  const rules = useEvolutionStore((s) => s.rules);
  const { activateRule } = useEvolutionStore();

  const filtered = statusFilter ? rules.filter((r) => r.status === statusFilter) : rules;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {["all", "active", "proposed", "rolled_back"].map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f === "all" ? null : f)}
            className="text-[0.6rem] px-2 py-1 rounded transition-colors"
            style={{
              background: (f === "all" && !statusFilter) || statusFilter === f
                ? "rgba(167, 139, 250, 0.15)"
                : "rgba(255,255,255,0.03)",
              color: (f === "all" && !statusFilter) || statusFilter === f
                ? "#a78bfa"
                : "var(--pn-text-muted)",
              border: "1px solid transparent",
            }}
          >
            {f === "rolled_back" ? "rolled back" : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
            No rules found
          </span>
        </div>
      ) : (
        filtered.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onEdit={() => onEdit(rule)}
            onRollback={() => onRollback(rule)}
            onActivate={() => activateRule(rule.id)}
          />
        ))
      )}
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
  onRollback,
  onActivate,
}: {
  readonly rule: BehaviorRule;
  readonly onEdit: () => void;
  readonly onRollback: () => void;
  readonly onActivate: () => void;
}) {
  const statusColor = STATUS_COLORS[rule.status] ?? "var(--pn-text-muted)";

  return (
    <div className="glass-surface rounded-lg p-3">
      <div className="flex items-start gap-2.5">
        <span
          className="shrink-0 rounded-full mt-1"
          style={{ width: "8px", height: "8px", background: statusColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
              {rule.content.length > 80 ? `${rule.content.slice(0, 80)}...` : rule.content}
            </span>
            <span
              className="shrink-0 text-[0.55rem] px-1.5 py-0.5 rounded"
              style={{ background: `${statusColor}18`, color: statusColor }}
            >
              {rule.status === "rolled_back" ? "rolled back" : rule.status}
            </span>
            <span
              className="shrink-0 text-[0.55rem] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(107, 149, 240, 0.12)", color: "#6b95f0" }}
            >
              v{rule.version}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>
              {rule.source}
            </span>
            <span className="text-[0.55rem] ml-auto" style={{ color: "var(--pn-text-muted)" }}>
              {new Date(rule.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <ActionBtn label="Edit" color="#6b95f0" onClick={onEdit} />
            {rule.status === "proposed" && (
              <ActionBtn label="Activate" color="#22c55e" onClick={onActivate} />
            )}
            {rule.status === "active" && (
              <ActionBtn label="Rollback" color="#ef4444" onClick={onRollback} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalsTab() {
  const signals = useEvolutionStore((s) => s.signals);
  const { triggerScan } = useEvolutionStore();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
          Recent Signals
        </span>
        <button
          onClick={() => triggerScan()}
          className="text-[0.6rem] px-2.5 py-1 rounded transition-opacity hover:opacity-80"
          style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}
        >
          Scan Now
        </button>
      </div>

      {signals.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
            No signals detected yet
          </span>
        </div>
      ) : (
        signals.map((signal) => (
          <div key={signal.id} className="glass-surface rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                {signal.source}
              </span>
              <span className="text-[0.55rem] ml-auto" style={{ color: "var(--pn-text-muted)" }}>
                {new Date(signal.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-[0.65rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
              {signal.content}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

function StatsTab() {
  const stats = useEvolutionStore((s) => s.stats);
  const [instruction, setInstruction] = useState("");
  const { proposeEvolution } = useEvolutionStore();

  async function handlePropose() {
    if (!instruction.trim()) return;
    await proposeEvolution(instruction.trim());
    setInstruction("");
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>No stats available</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Active Rules" value={stats.rules.active_rules} color="#22c55e" />
        <StatCard label="Proposed" value={stats.rules.proposed_rules} color="#f59e0b" />
        <StatCard label="Rolled Back" value={stats.rules.rolled_back_rules} color="#ef4444" />
        <StatCard label="Total Scans" value={stats.scanner.total_scans} color="#6b95f0" />
        <StatCard label="Signals Detected" value={stats.scanner.signals_detected} color="#a78bfa" />
        <StatCard label="Total Rules" value={stats.rules.total_rules} color="var(--pn-text-secondary)" />
      </div>

      {stats.scanner.last_scan_at && (
        <div className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
          Last scan: {new Date(stats.scanner.last_scan_at).toLocaleString()}
        </div>
      )}

      {/* Source breakdown */}
      {Object.keys(stats.rules.sources).length > 0 && (
        <div>
          <span className="text-[0.65rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
            By Source
          </span>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(stats.rules.sources).map(([source, count]) => (
              <span key={source} className="text-[0.6rem] px-2 py-1 rounded glass-surface" style={{ color: "var(--pn-text-secondary)" }}>
                {source}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manual proposal input */}
      <div className="glass-surface rounded-lg p-3">
        <span className="text-[0.65rem] font-medium block mb-2" style={{ color: "var(--pn-text-secondary)" }}>
          Propose Evolution
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Describe a behavioral change..."
            className="flex-1 rounded px-2 py-1.5 text-[0.7rem]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handlePropose(); }}
          />
          <button
            onClick={handlePropose}
            className="text-[0.65rem] px-3 py-1.5 rounded transition-opacity hover:opacity-80"
            style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
          >
            Propose
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { readonly label: string; readonly value: number; readonly color: string }) {
  return (
    <div className="glass-surface rounded-lg p-3 flex flex-col items-center">
      <span className="text-[1.2rem] font-bold" style={{ color }}>{value}</span>
      <span className="text-[0.55rem] mt-0.5" style={{ color: "var(--pn-text-muted)" }}>{label}</span>
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { readonly label: string; readonly color: string; readonly onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-[0.6rem] font-medium px-2.5 py-1 rounded transition-opacity hover:opacity-80"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {label}
    </button>
  );
}
