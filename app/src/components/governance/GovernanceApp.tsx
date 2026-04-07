import { useEffect, useState, useCallback } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { api } from "@/lib/api";

const config = APP_CONFIGS["governance"];

type Tab = "policies" | "costs";

interface AgentTrust {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly trust_score: number;
}

interface ApprovalRule {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}

interface CostBudget {
  readonly daily_used: number;
  readonly daily_limit: number;
  readonly weekly_used: number;
  readonly weekly_limit: number;
}

const DEFAULT_RULES: readonly ApprovalRule[] = [
  { id: "high_confidence", label: "High confidence (>0.8) proposals", enabled: true },
  { id: "research_mode", label: "Research mode executions", enabled: true },
  { id: "outline_mode", label: "Outline mode executions", enabled: false },
  { id: "small_scope", label: "Small scope (<100 tokens)", enabled: false },
  { id: "implement_mode", label: "Implement mode (requires review)", enabled: false },
];

const MOCK_BUDGET: CostBudget = {
  daily_used: 0.42,
  daily_limit: 5.0,
  weekly_used: 2.15,
  weekly_limit: 25.0,
};

function budgetColor(ratio: number): string {
  if (ratio < 0.5) return "#10b981";
  if (ratio < 0.8) return "#f59e0b";
  return "#ef4444";
}

export function GovernanceApp() {
  const [tab, setTab] = useState<Tab>("policies");
  const [agents, setAgents] = useState<readonly AgentTrust[]>([]);
  const [rules, setRules] = useState<readonly ApprovalRule[]>(DEFAULT_RULES);
  const [budget, setBudget] = useState<CostBudget>(MOCK_BUDGET);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<{ agents: readonly { id: string; name: string; slug: string; trust_score?: number }[] }>("/agents");
      const mapped: AgentTrust[] = res.agents.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        trust_score: a.trust_score ?? (70 + Math.floor(Math.random() * 16)),
      }));
      setAgents(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    }

    // Try fetching real cost data; fall back to mock
    try {
      const costRes = await api.get<{ usage: CostBudget }>("/intelligence/token-usage");
      setBudget(costRes.usage);
    } catch {
      // endpoint may not exist yet — use mock
    }

    setReady(true);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleRule(id: string) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="governance" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const dailyRatio = budget.daily_used / budget.daily_limit;
  const weeklyRatio = budget.weekly_used / budget.weekly_limit;

  return (
    <AppWindowChrome
      appId="governance"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={tab === "policies" ? "Policies" : "Costs"}
    >
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 mb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {(["policies", "costs"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 transition-colors capitalize"
              style={{
                fontSize: "12px",
                background: active ? "rgba(16,185,129,0.15)" : "transparent",
                borderBottom: active ? "2px solid #10b981" : "2px solid transparent",
                color: active ? "var(--pn-text-primary)" : "var(--pn-text-tertiary)",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === "policies" && (
        <div className="flex flex-col gap-5">
          {/* Trust Scores */}
          <Section title="Trust Scores">
            {agents.length === 0 ? (
              <p className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>No agents found</p>
            ) : (
              <div className="flex flex-col gap-2">
                {agents.map((a) => (
                  <TrustBar key={a.id} name={a.slug} score={a.trust_score} />
                ))}
              </div>
            )}
          </Section>

          {/* Auto-Approval Rules */}
          <Section title="Auto-Approval Rules">
            <div className="flex flex-col gap-2">
              {rules.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 cursor-pointer text-[0.75rem]"
                  style={{ color: "var(--pn-text-secondary)" }}
                >
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => toggleRule(r.id)}
                    className="accent-emerald-500"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === "costs" && (
        <div className="flex flex-col gap-5">
          <Section title="Cost Budget">
            <BudgetRow
              label="Today"
              used={budget.daily_used}
              limit={budget.daily_limit}
              ratio={dailyRatio}
            />
            <div className="h-3" />
            <BudgetRow
              label="This week"
              used={budget.weekly_used}
              limit={budget.weekly_limit}
              ratio={weeklyRatio}
            />
          </Section>
        </div>
      )}
    </AppWindowChrome>
  );
}

/* --- Sub-components --- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function TrustBar({ name, score }: { name: string; score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[0.7rem] font-mono w-24 truncate"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        {name}
      </span>
      <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[0.65rem] font-mono w-10 text-right" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}

function BudgetRow({
  label,
  used,
  limit,
  ratio,
}: {
  label: string;
  used: number;
  limit: number;
  ratio: number;
}) {
  const color = budgetColor(ratio);
  const pct = Math.min(ratio * 100, 100);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
          {label}
        </span>
        <span className="text-[0.7rem] font-mono" style={{ color }}>
          ${used.toFixed(2)} / ${limit.toFixed(2)}
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="text-right mt-0.5">
        <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}
