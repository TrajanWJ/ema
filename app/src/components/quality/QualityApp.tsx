import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface FrictionSignal {
  type: string;
  count: number;
  weight: number;
}

interface FrictionReport {
  friction_score: number;
  severity: string;
  signals: FrictionSignal[];
  scanned_at: string | null;
}

interface GradientMetrics {
  approval_rate: number;
  completion_rate: number;
}

interface QualityGradient {
  current: GradientMetrics;
  previous: GradientMetrics;
  gradient: GradientMetrics;
  trend: string;
  window_days: number;
  computed_at: string;
}

interface BudgetSummary {
  date: string;
  total_tokens: number;
  total_cost_cents: number;
  token_limit: number;
  cost_limit_cents: number;
  token_pct: number;
  cost_pct: number;
  entry_count: number;
}

interface ThreatFinding {
  type: string;
  severity: string;
  message: string;
  action: string;
}

interface ThreatReport {
  findings: ThreatFinding[];
  checked_at: string | null;
}

interface QualityReport {
  friction: FrictionReport;
  gradient: QualityGradient;
  budget: BudgetSummary;
  threats: ThreatReport;
}

const TABS = ['Friction', 'Trends', 'Budget', 'Threats'] as const;
type Tab = (typeof TABS)[number];

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-green-400 bg-green-500/20',
  medium: 'text-amber-400 bg-amber-500/20',
  high: 'text-red-400 bg-red-500/20',
};

const TREND_ICONS: Record<string, string> = {
  improving: '\u2191',
  stable: '\u2192',
  degrading: '\u2193',
};

export default function QualityApp() {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Friction');
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    try {
      const data = await api.get<QualityReport>('/quality/report');
      setReport(data);
    } catch (err) {
      console.error('Failed to load quality report:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
    const interval = setInterval(loadReport, 60_000);
    return () => clearInterval(interval);
  }, [loadReport]);

  if (loading || !report) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-secondary">Loading quality data...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 p-2 border-b border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-tertiary hover:text-secondary hover:bg-white/[0.04]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'Friction' && <FrictionTab friction={report.friction} />}
        {activeTab === 'Trends' && <TrendsTab gradient={report.gradient} />}
        {activeTab === 'Budget' && <BudgetTab budget={report.budget} />}
        {activeTab === 'Threats' && <ThreatsTab threats={report.threats} />}
      </div>
    </div>
  );
}

function FrictionTab({ friction }: { friction: FrictionReport }) {
  const pct = Math.round(friction.friction_score * 100);
  const severityClass = SEVERITY_COLORS[friction.severity] ?? SEVERITY_COLORS.low;

  return (
    <div className="space-y-4">
      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-primary">Friction Score</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs ${severityClass}`}>
            {friction.severity}
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-500/60 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-tertiary mt-1">{pct}%</p>
      </div>

      {friction.signals.length > 0 && (
        <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
          <h3 className="text-sm font-semibold text-primary mb-2">Signals</h3>
          <div className="space-y-2">
            {friction.signals.map((signal, i) => (
              <div
                key={`${signal.type}-${i}`}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-secondary">{String(signal.type).replace(/_/g, ' ')}</span>
                <span className="text-tertiary">count: {signal.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendsTab({ gradient }: { gradient: QualityGradient }) {
  const trendIcon = TREND_ICONS[gradient.trend] ?? '?';
  const trendColor =
    gradient.trend === 'improving'
      ? 'text-green-400'
      : gradient.trend === 'degrading'
        ? 'text-red-400'
        : 'text-secondary';

  return (
    <div className="space-y-4">
      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-primary">Quality Trend</h3>
          <span className={`text-lg ${trendColor}`}>{trendIcon}</span>
          <span className={`text-xs ${trendColor}`}>{gradient.trend}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Approval Rate"
            current={gradient.current.approval_rate}
            delta={gradient.gradient.approval_rate}
          />
          <MetricCard
            label="Completion Rate"
            current={gradient.current.completion_rate}
            delta={gradient.gradient.completion_rate}
          />
        </div>

        <p className="text-[10px] text-tertiary mt-3">
          {gradient.window_days}-day window
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  current,
  delta,
}: {
  label: string;
  current: number;
  delta: number;
}) {
  const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-tertiary';
  const deltaSign = delta > 0 ? '+' : '';

  return (
    <div className="glass-ambient rounded-lg p-3 border border-white/[0.04]">
      <p className="text-[10px] text-tertiary mb-1">{label}</p>
      <p className="text-lg font-semibold text-primary">
        {(current * 100).toFixed(1)}%
      </p>
      <p className={`text-xs ${deltaColor}`}>
        {deltaSign}{(delta * 100).toFixed(1)}%
      </p>
    </div>
  );
}

function BudgetTab({ budget }: { budget: BudgetSummary }) {
  return (
    <div className="space-y-4">
      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <h3 className="text-sm font-semibold text-primary mb-3">Token Usage</h3>
        <div className="w-full h-3 rounded-full bg-white/[0.06] overflow-hidden mb-1">
          <div
            className="h-full rounded-full bg-blue-500/60 transition-all"
            style={{ width: `${Math.min(budget.token_pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-tertiary">
          <span>{budget.total_tokens.toLocaleString()} tokens</span>
          <span>{budget.token_pct}%</span>
        </div>
      </div>

      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <h3 className="text-sm font-semibold text-primary mb-3">Cost</h3>
        <div className="w-full h-3 rounded-full bg-white/[0.06] overflow-hidden mb-1">
          <div
            className="h-full rounded-full bg-amber-500/60 transition-all"
            style={{ width: `${Math.min(budget.cost_pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-tertiary">
          <span>${(budget.total_cost_cents / 100).toFixed(2)}</span>
          <span>{budget.cost_pct}%</span>
        </div>
      </div>

      <div className="glass-ambient rounded-lg p-3 border border-white/[0.04]">
        <p className="text-xs text-tertiary">{budget.entry_count} API calls today</p>
      </div>
    </div>
  );
}

function ThreatsTab({ threats }: { threats: ThreatReport }) {
  return (
    <div className="space-y-4">
      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <h3 className="text-sm font-semibold text-primary mb-3">Threat Findings</h3>
        {threats.findings.length === 0 ? (
          <p className="text-xs text-tertiary">No threats detected</p>
        ) : (
          <div className="space-y-2">
            {threats.findings.map((finding, i) => {
              const severityClass =
                SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.low;
              return (
                <div
                  key={`${finding.type}-${i}`}
                  className="glass-ambient rounded-lg p-3 border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${severityClass}`}>
                      {finding.severity}
                    </span>
                    <span className="text-xs text-secondary">{finding.message}</span>
                  </div>
                  <p className="text-[10px] text-tertiary">{finding.action}</p>
                </div>
              );
            })}
          </div>
        )}
        {threats.checked_at && (
          <p className="text-[10px] text-tertiary mt-2">
            Last check: {new Date(threats.checked_at).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
