import { useActorsStore } from "@/stores/actors-store";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Actor } from "@/types/actors";

const PHASE_COLORS: Record<string, string> = {
  idle: "#6b7280",
  plan: "#3b82f6",
  execute: "#22c55e",
  review: "#f59e0b",
  retro: "#a855f7",
};

const PHASE_ORDER = ["idle", "plan", "execute", "review", "retro"] as const;

function nextPhase(current: string): string {
  const idx = PHASE_ORDER.indexOf(current as (typeof PHASE_ORDER)[number]);
  if (idx === -1 || idx === PHASE_ORDER.length - 1) return PHASE_ORDER[0];
  return PHASE_ORDER[idx + 1];
}

function PhaseIndicator({ phase }: { readonly phase: string }) {
  const color = PHASE_COLORS[phase] ?? PHASE_COLORS.idle;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[0.65rem] font-medium px-2 py-0.5 rounded-full"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      <span
        className="rounded-full"
        style={{ width: 6, height: 6, background: color }}
      />
      {phase}
    </span>
  );
}

function ActorRow({ actor }: { readonly actor: Actor }) {
  const transitionPhase = useActorsStore((s) => s.transitionPhase);
  const next = nextPhase(actor.phase);

  async function handleAdvance() {
    try {
      await transitionPhase(actor.id, next, `Advanced from ${actor.phase}`);
    } catch {
      console.warn("Phase transition failed for", actor.slug);
    }
  }

  return (
    <div
      className="flex items-center gap-3 py-2 px-1"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div
        className="flex items-center justify-center rounded-md text-[0.65rem] font-bold uppercase shrink-0"
        style={{
          width: 28,
          height: 28,
          background:
            actor.type === "human"
              ? "rgba(59,130,246,0.15)"
              : "rgba(34,197,94,0.15)",
          color: actor.type === "human" ? "#3b82f6" : "#22c55e",
        }}
      >
        {actor.type === "human" ? "H" : "A"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[0.75rem] font-medium truncate"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {actor.name}
          </span>
          <span
            className="text-[0.6rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {actor.slug}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <PhaseIndicator phase={actor.phase} />
          <span
            className="text-[0.6rem]"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            {actor.status}
          </span>
        </div>
      </div>
      <button
        onClick={handleAdvance}
        className="shrink-0 px-2 py-1 rounded text-[0.65rem] font-medium transition-opacity hover:opacity-80"
        style={{
          background: "rgba(255,255,255,0.04)",
          color: PHASE_COLORS[next] ?? "var(--pn-text-secondary)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
        title={`Advance to ${next}`}
      >
        {next}
      </button>
    </div>
  );
}

export function WorkspaceTab() {
  const actors = useActorsStore((s) => s.actors);
  const loading = useActorsStore((s) => s.loading);

  const humans = actors.filter((a) => a.type === "human");
  const agents = actors.filter((a) => a.type === "agent");

  if (loading && actors.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Loading actors...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h2
        className="text-[0.9rem] font-semibold"
        style={{ color: "var(--pn-text-primary)" }}
      >
        Workspace
      </h2>

      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-[0.7rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Actors
          </h3>
          <span
            className="text-[0.65rem] font-mono"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {actors.length} total
          </span>
        </div>

        {humans.length > 0 && (
          <div className="mb-3">
            <span
              className="text-[0.6rem] uppercase tracking-wider"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Humans ({humans.length})
            </span>
            {humans.map((actor) => (
              <ActorRow key={actor.id} actor={actor} />
            ))}
          </div>
        )}

        {agents.length > 0 && (
          <div>
            <span
              className="text-[0.6rem] uppercase tracking-wider"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Agents ({agents.length})
            </span>
            {agents.map((actor) => (
              <ActorRow key={actor.id} actor={actor} />
            ))}
          </div>
        )}

        {actors.length === 0 && (
          <p
            className="text-[0.75rem] py-4 text-center"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            No actors found. The daemon may not be running.
          </p>
        )}
      </GlassCard>

      <GlassCard>
        <h3
          className="text-[0.7rem] font-medium uppercase tracking-wider mb-3"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Spaces
        </h3>
        <p
          className="text-[0.7rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Space management coming soon. Spaces will provide isolated contexts
          (Work, Personal, Health) with separate vaults, settings, and AI
          context.
        </p>
      </GlassCard>
    </div>
  );
}
