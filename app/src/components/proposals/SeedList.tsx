import { useState } from "react";
import { useProposalsStore } from "@/stores/proposals-store";
import { SeedForm } from "./SeedForm";

export function SeedList() {
  const [showForm, setShowForm] = useState(false);
  const seeds = useProposalsStore((s) => s.seeds);
  const toggleSeed = useProposalsStore((s) => s.toggleSeed);
  const runSeedNow = useProposalsStore((s) => s.runSeedNow);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span
          className="text-[0.65rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Seeds ({seeds.length})
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="text-[0.65rem] font-medium px-2.5 py-1 rounded"
          style={{
            background: "rgba(167, 139, 250, 0.12)",
            color: "#a78bfa",
          }}
        >
          + New Seed
        </button>
      </div>

      {showForm && (
        <div
          className="glass-surface rounded-lg p-3"
          style={{ border: "1px solid var(--pn-border-subtle)" }}
        >
          <SeedForm onClose={() => setShowForm(false)} />
        </div>
      )}

      {seeds.length === 0 && !showForm && (
        <div className="flex items-center justify-center py-8">
          <span
            className="text-[0.75rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            No seeds configured
          </span>
        </div>
      )}

      {seeds.map((seed) => (
        <div
          key={seed.id}
          className="glass-surface rounded-lg p-3 flex items-center gap-3"
          style={{ border: "1px solid var(--pn-border-subtle)" }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[0.75rem] font-medium"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {seed.name}
              </span>
              <span
                className="text-[0.55rem] px-1.5 py-0.5 rounded"
                style={{
                  background: seed.active
                    ? "rgba(34, 197, 94, 0.1)"
                    : "rgba(255, 255, 255, 0.04)",
                  color: seed.active ? "#22c55e" : "var(--pn-text-muted)",
                }}
              >
                {seed.active ? "active" : "paused"}
              </span>
            </div>
            <div
              className="flex items-center gap-3 text-[0.6rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {seed.schedule && <span>{seed.schedule}</span>}
              <span>{seed.run_count} runs</span>
              {seed.last_run_at && (
                <span>
                  last: {new Date(seed.last_run_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => toggleSeed(seed.id)}
              className="text-[0.6rem] px-2 py-1 rounded transition-opacity hover:opacity-80"
              style={{
                background: seed.active
                  ? "rgba(245, 158, 11, 0.1)"
                  : "rgba(34, 197, 94, 0.1)",
                color: seed.active ? "#f59e0b" : "#22c55e",
              }}
            >
              {seed.active ? "Pause" : "Enable"}
            </button>
            <button
              onClick={() => runSeedNow(seed.id)}
              className="text-[0.6rem] px-2 py-1 rounded transition-opacity hover:opacity-80"
              style={{
                background: "rgba(167, 139, 250, 0.1)",
                color: "#a78bfa",
              }}
            >
              Run Now
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
