import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface DccSession {
  session_id: string;
  crystallized_at: string | null;
  project_id: string | null;
  active_task_ids: string[];
  decision_hashes: string[];
  intent_snapshot: Record<string, unknown>;
  proposal_context: Record<string, unknown>;
  session_narrative: string | null;
  metadata: Record<string, unknown>;
}

export default function ContextCrystallizationApp() {
  const [currentSession, setCurrentSession] = useState<DccSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<DccSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [crystallizing, setCrystallizing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [current, recent] = await Promise.all([
        api.get<{ session: DccSession | null }>('/context'),
        api.get<{ sessions: DccSession[] }>('/context/sessions'),
      ]);
      setCurrentSession(current.session);
      setRecentSessions(recent.sessions);
    } catch (err) {
      console.error('Failed to load context data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCrystallize = async () => {
    setCrystallizing(true);
    try {
      const result = await api.post<{ session: DccSession }>('/context/crystallize', {});
      setCurrentSession(result.session);
      await loadData();
    } catch (err) {
      console.error('Crystallization failed:', err);
    } finally {
      setCrystallizing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-secondary">Loading session context...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Active Session */}
      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-primary tracking-wide uppercase">
            Active Session
          </h2>
          {currentSession?.crystallized_at && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-teal-500/20 text-teal-400">
              Crystallized
            </span>
          )}
        </div>

        {currentSession ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-secondary">
              <span className="font-mono">{currentSession.session_id}</span>
            </div>
            {currentSession.project_id && (
              <p className="text-xs text-tertiary">
                Project: {currentSession.project_id}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-tertiary">
              <span>{currentSession.active_task_ids.length} tasks</span>
              <span>{currentSession.decision_hashes.length} decisions</span>
            </div>
            {currentSession.session_narrative && (
              <p className="text-xs text-secondary mt-2 leading-relaxed">
                {currentSession.session_narrative}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-tertiary">No active session</p>
        )}

        <button
          onClick={handleCrystallize}
          disabled={crystallizing}
          className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium
            bg-teal-500/20 text-teal-400 hover:bg-teal-500/30
            disabled:opacity-40 transition-colors"
        >
          {crystallizing ? 'Crystallizing...' : 'Crystallize Session'}
        </button>
      </div>

      {/* Recent Sessions */}
      <div className="glass-surface rounded-xl p-4 border border-white/[0.08]">
        <h2 className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">
          Recent Sessions
        </h2>
        {recentSessions.length === 0 ? (
          <p className="text-xs text-tertiary">No sessions yet</p>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <div
                key={session.session_id}
                className="glass-ambient rounded-lg p-3 border border-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-secondary">
                    {session.session_id.slice(0, 20)}...
                  </span>
                  {session.crystallized_at ? (
                    <span className="text-[10px] text-teal-400">
                      {new Date(session.crystallized_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400">active</span>
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-tertiary">
                  <span>{session.active_task_ids.length} tasks</span>
                  <span>{session.decision_hashes.length} decisions</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
