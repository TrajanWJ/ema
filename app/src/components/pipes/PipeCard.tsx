import type { Pipe } from "@/types/pipes";
import { usePipesStore } from "@/stores/pipes-store";

interface PipeCardProps {
  readonly pipe: Pipe;
}

export function PipeCard({ pipe }: PipeCardProps) {
  const toggle = usePipesStore((s) => s.toggle);

  return (
    <div className="glass-surface rounded-lg p-3 mb-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="rounded-full shrink-0"
          style={{
            width: "8px",
            height: "8px",
            background: pipe.active ? "#22c55e" : "var(--pn-text-tertiary)",
          }}
        />
        <span
          className="text-[0.8rem] font-medium flex-1 truncate"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {pipe.name}
        </span>
        {pipe.system && (
          <span
            className="text-[0.55rem] px-1.5 py-0.5 rounded-md uppercase"
            style={{ background: "rgba(255, 255, 255, 0.04)", color: "var(--pn-text-tertiary)" }}
          >
            System
          </span>
        )}
        <button
          onClick={() => toggle(pipe.id)}
          className="text-[0.6rem] px-2 py-0.5 rounded-md transition-colors"
          style={{
            background: pipe.active ? "rgba(34, 197, 94, 0.1)" : "rgba(255, 255, 255, 0.03)",
            color: pipe.active ? "#22c55e" : "var(--pn-text-tertiary)",
          }}
        >
          {pipe.active ? "On" : "Off"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="text-[0.6rem] px-1.5 py-0.5 rounded-md font-mono"
          style={{ background: "rgba(167, 139, 250, 0.08)", color: "#a78bfa" }}
        >
          {pipe.trigger_pattern}
        </span>
        <span className="text-[0.55rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          &rarr;
        </span>
        <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          {pipe.actions.length} action{pipe.actions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {pipe.description && (
        <div className="text-[0.65rem] mt-1.5" style={{ color: "var(--pn-text-tertiary)" }}>
          {pipe.description}
        </div>
      )}

      {pipe.actions.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--pn-border-subtle)" }}>
          {pipe.actions.map((action) => (
            <div
              key={action.id}
              className="text-[0.6rem] font-mono py-0.5"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              {action.sort_order + 1}. {action.action_id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
