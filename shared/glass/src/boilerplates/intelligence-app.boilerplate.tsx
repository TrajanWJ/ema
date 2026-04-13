import { DashboardShell } from "../templates/DashboardShell.tsx";
import { GlassCard } from "../components/GlassCard/index.ts";
import { StatusDot } from "../components/StatusDot/index.ts";

/**
 * intelligence-app boilerplate — agents/intent-schematic style. Violet
 * accent. Demonstrates the DashboardShell with a hero and card grid.
 */
export function IntelligenceAppBoilerplate() {
  return (
    <DashboardShell
      appId="agents"
      title="AGENTS"
      icon="&#8862;"
      accent="#a78bfa"
      hero={
        <GlassCard title="Active Fleet">
          <div style={{ display: "flex", gap: "var(--pn-space-4)" }}>
            <StatusDot kind="running" label="3 running" pulse />
            <StatusDot kind="idle" label="2 idle" />
            <StatusDot kind="error" label="1 failed" />
          </div>
        </GlassCard>
      }
      cards={
        <>
          <GlassCard title="Parliament">
            <p style={{ color: "var(--pn-text-secondary)", fontSize: "0.75rem" }}>
              Multi-voice debate runtime. 4 voices staged.
            </p>
          </GlassCard>
          <GlassCard title="Combiner">
            <p style={{ color: "var(--pn-text-secondary)", fontSize: "0.75rem" }}>
              Cross-pollination synthesis. Last run 2h ago.
            </p>
          </GlassCard>
          <GlassCard title="SuperMan">
            <p style={{ color: "var(--pn-text-secondary)", fontSize: "0.75rem" }}>
              Intelligence CLI. Thinking...
            </p>
          </GlassCard>
        </>
      }
    />
  );
}
