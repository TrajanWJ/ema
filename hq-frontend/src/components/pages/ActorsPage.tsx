import { useEffect, useState } from "react";
import { useActorStore, type Actor } from "../../store/actorStore";

const PHASE_COLORS: Record<string, string> = {
  idle: "var(--dim)",
  plan: "var(--accent)",
  execute: "var(--orange)",
  review: "var(--purple)",
  retro: "var(--green)",
};

const PHASES = ["plan", "execute", "review", "retro"] as const;

export function ActorsPage() {
  const { actors, loading, transitionPhase, listPhases, phases } = useActorStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const humans = actors.filter((a) => a.type === "human");
  const agents = actors.filter((a) => a.type === "agent");

  return (
    <div className="page">
      <div className="page-title">
        <h1>Actors</h1>
        <div className="row">
          <span className="badge">{humans.length} human</span>
          <span className="badge">{agents.length} agents</span>
        </div>
      </div>

      {loading && actors.length === 0 && (
        <div className="muted" style={{ textAlign: "center", padding: 32 }}>Loading actors...</div>
      )}

      <div className="card-list">
        {actors.map((actor) => (
          <ActorCard
            key={actor.id}
            actor={actor}
            expanded={expandedId === actor.id}
            transitions={phases[actor.id] || []}
            onToggle={() => {
              const next = expandedId === actor.id ? null : actor.id;
              setExpandedId(next);
              if (next) listPhases(actor.id);
            }}
            onTransition={(phase) => transitionPhase(actor.id, phase)}
          />
        ))}
      </div>
    </div>
  );
}

function ActorCard({
  actor,
  expanded,
  transitions,
  onToggle,
  onTransition,
}: {
  actor: Actor;
  expanded: boolean;
  transitions: { from_phase: string | null; to_phase: string; reason: string | null; transitioned_at: string; week_number: number | null }[];
  onToggle: () => void;
  onTransition: (phase: string) => void;
}) {
  return (
    <div className="glass panel">
      <div className="row-between" onClick={onToggle} style={{ cursor: "pointer" }}>
        <div className="row">
          <span style={{ fontSize: 18 }}>{actor.type === "human" ? "◎" : "⬡"}</span>
          <div>
            <strong>{actor.name}</strong>
            <div className="muted" style={{ fontSize: 10 }}>{actor.slug}</div>
          </div>
        </div>
        <div className="row">
          <span
            className="badge"
            style={{
              background: `${PHASE_COLORS[actor.phase] || "var(--dim)"}20`,
              color: PHASE_COLORS[actor.phase] || "var(--muted)",
            }}
          >
            {actor.phase}
          </span>
          <span className="badge">{actor.type}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            {PHASES.map((p) => (
              <button
                key={p}
                onClick={() => onTransition(p)}
                style={{
                  background: actor.phase === p ? `${PHASE_COLORS[p]}20` : undefined,
                  color: actor.phase === p ? PHASE_COLORS[p] : undefined,
                  fontSize: 11,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
            Status: {actor.status}
            {actor.phase_started_at && (
              <> · Phase since {new Date(actor.phase_started_at).toLocaleString()}</>
            )}
          </div>

          {transitions.length > 0 && (
            <div className="card" style={{ fontSize: 11 }}>
              <strong>Phase History</strong>
              {transitions.slice(0, 10).map((t, i) => (
                <div key={i} className="row" style={{ marginTop: 4 }}>
                  <span style={{ color: PHASE_COLORS[t.from_phase || "idle"] }}>{t.from_phase || "—"}</span>
                  <span className="dim">→</span>
                  <span style={{ color: PHASE_COLORS[t.to_phase] }}>{t.to_phase}</span>
                  {t.week_number != null && <span className="badge">W{t.week_number}</span>}
                  {t.reason && <span className="muted">{t.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
