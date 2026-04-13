import { useState } from "react";
import { ListDetailShell } from "../templates/ListDetailShell.tsx";
import { GlassCard } from "../components/GlassCard/index.ts";
import { GlassInput } from "../components/GlassInput/index.ts";
import { GlassButton } from "../components/GlassButton/index.ts";
import { EmptyState } from "../components/EmptyState/index.ts";
import { StatusDot } from "../components/StatusDot/index.ts";

interface TaskItem {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "running" | "done";
}

const SEED: readonly TaskItem[] = [
  { id: "t-1", title: "Wire vault seeder to intent pipeline", status: "open" },
  { id: "t-2", title: "Port Ema.Pipes 22/15/5 registry", status: "running" },
  { id: "t-3", title: "Draft Parliament multi-voice proposal", status: "open" },
];

/**
 * work-app boilerplate — Tasks-style list/detail vApp. Demonstrates the
 * accent color for the Work group (teal) and a voice-compliant empty detail.
 */
export function WorkAppBoilerplate() {
  const [tasks] = useState<readonly TaskItem[]>(SEED);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((t) => t.id === selectedId);

  return (
    <ListDetailShell
      appId="tasks"
      title="TASKS"
      icon="&#9744;"
      accent="var(--color-pn-teal-400)"
      list={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-2)" }}>
          <GlassInput uiSize="sm" placeholder="Filter tasks" />
          {tasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              style={{
                textAlign: "left",
                padding: "var(--pn-space-2) var(--pn-space-3)",
                borderRadius: "var(--pn-radius-md)",
                background:
                  t.id === selectedId ? "var(--pn-field-bg-active)" : "transparent",
                border: "1px solid var(--pn-border-subtle)",
                color: "var(--pn-text-primary)",
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "var(--pn-space-2)",
              }}
            >
              <StatusDot
                kind={
                  t.status === "running"
                    ? "running"
                    : t.status === "done"
                      ? "success"
                      : "idle"
                }
                pulse={t.status === "running"}
              />
              <span>{t.title}</span>
            </button>
          ))}
        </div>
      }
      detail={
        selected ? (
          <GlassCard title={selected.title}>
            <p style={{ color: "var(--pn-text-secondary)", fontSize: "0.8rem" }}>
              Status: {selected.status}
            </p>
            <div style={{ marginTop: "var(--pn-space-3)", display: "flex", gap: "var(--pn-space-2)" }}>
              <GlassButton variant="primary" uiSize="sm">
                Start
              </GlassButton>
              <GlassButton uiSize="sm">Archive</GlassButton>
            </div>
          </GlassCard>
        ) : (
          <EmptyState
            glyph="&#9744;"
            title="Select a task"
            description="Pick one from the list to see its detail."
          />
        )
      }
    />
  );
}
