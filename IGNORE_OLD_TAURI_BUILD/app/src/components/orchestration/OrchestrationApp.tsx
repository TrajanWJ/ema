import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { joinChannel } from '../../lib/ws';

interface FitnessEntry {
  agent_id: string;
  total_runs: number;
  successes: number;
  success_rate: number;
  avg_latency_ms: number;
  task_affinity: Record<string, number>;
  composite_score: number;
  last_run: string | null;
}

interface RoutingDecision {
  agent_id: string;
  agent_slug: string;
  task_type: string;
  strategy: string;
  decided_at: string;
}

interface RoutingStats {
  total_routed: number;
  strategy_counts: Record<string, number>;
  recent_decisions: Array<{
    task_type: string;
    strategy: string;
    at: string;
  }>;
}

interface OrchestrationStats {
  routing: RoutingStats;
  fitness_count: number;
  top_agents: FitnessEntry[];
}

export default function OrchestrationApp() {
  const [stats, setStats] = useState<OrchestrationStats | null>(null);
  const [fitnessScores, setFitnessScores] = useState<FitnessEntry[]>([]);
  const [liveDecisions, setLiveDecisions] = useState<RoutingDecision[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statsData, fitnessData] = await Promise.all([
        api.get<OrchestrationStats>('/orchestration/stats'),
        api.get<{ fitness: FitnessEntry[] }>('/orchestration/fitness'),
      ]);
      setStats(statsData);
      setFitnessScores(fitnessData.fitness);
    } catch (err) {
      console.error('Failed to load orchestration data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let mounted = true;

    joinChannel('orchestration:routing')
      .then(({ channel }) => {
        channel.on('routing_decision', (decision: RoutingDecision) => {
          if (mounted) {
            setLiveDecisions((prev) => [decision, ...prev].slice(0, 20));
          }
        });
      })
      .catch((err) => {
        console.warn('Could not join orchestration channel:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-secondary">Loading orchestration data...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Routing Stats */}
      {stats && (
        <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
          <h2 className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">
            Routing Stats
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-ambient rounded-lg p-3 border border-white/[0.04]">
              <p className="text-[10px] text-tertiary">Total Routed</p>
              <p className="text-lg font-semibold text-primary">{stats.routing.total_routed}</p>
            </div>
            <div className="glass-ambient rounded-lg p-3 border border-white/[0.04]">
              <p className="text-[10px] text-tertiary">Agents Tracked</p>
              <p className="text-lg font-semibold text-primary">{stats.fitness_count}</p>
            </div>
            <div className="glass-ambient rounded-lg p-3 border border-white/[0.04]">
              <p className="text-[10px] text-tertiary">Strategies Used</p>
              <p className="text-lg font-semibold text-primary">
                {Object.keys(stats.routing.strategy_counts).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fitness Table */}
      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <h2 className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">
          Agent Fitness
        </h2>
        {fitnessScores.length === 0 ? (
          <p className="text-xs text-tertiary">No fitness data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-tertiary border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-3">Agent</th>
                  <th className="text-right py-2 px-2">Success</th>
                  <th className="text-right py-2 px-2">Latency</th>
                  <th className="text-right py-2 px-2">Score</th>
                  <th className="text-left py-2 pl-2">Top Specialization</th>
                </tr>
              </thead>
              <tbody>
                {fitnessScores.map((entry) => {
                  const topSpec = Object.entries(entry.task_affinity)
                    .sort(([, a], [, b]) => b - a)[0];

                  return (
                    <tr
                      key={entry.agent_id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                    >
                      <td className="py-2 pr-3 text-secondary font-mono">
                        {entry.agent_id.slice(0, 12)}
                      </td>
                      <td className="py-2 px-2 text-right text-primary">
                        {(entry.success_rate * 100).toFixed(0)}%
                      </td>
                      <td className="py-2 px-2 text-right text-tertiary">
                        {entry.avg_latency_ms.toFixed(0)}ms
                      </td>
                      <td className="py-2 px-2 text-right text-blue-400">
                        {entry.composite_score.toFixed(2)}
                      </td>
                      <td className="py-2 pl-2 text-tertiary">
                        {topSpec ? `${topSpec[0]} (${(topSpec[1] * 100).toFixed(0)}%)` : '\u2014'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Routing Decisions */}
      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <h2 className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">
          Recent Routing Decisions
        </h2>
        {liveDecisions.length === 0 ? (
          <p className="text-xs text-tertiary">No routing decisions yet</p>
        ) : (
          <div className="space-y-2">
            {liveDecisions.map((decision, i) => (
              <div
                key={`${decision.decided_at}-${i}`}
                className="glass-ambient rounded-lg p-3 border border-white/[0.04] flex items-center justify-between"
              >
                <div>
                  <span className="text-xs text-secondary">{decision.agent_slug}</span>
                  <span className="text-[10px] text-tertiary ml-2">
                    {decision.task_type} via {decision.strategy}
                  </span>
                </div>
                <span className="text-[10px] text-tertiary">
                  {new Date(decision.decided_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
