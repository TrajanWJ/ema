import { DashboardShell } from "../templates/DashboardShell.tsx";
import { GlassCard } from "../components/GlassCard/index.ts";
import { StatusDot } from "../components/StatusDot/index.ts";
import { GlassButton } from "../components/GlassButton/index.ts";

/**
 * operations-app boilerplate — babysitter/governance/decision-log. Amber or
 * emerald accent. Shows a status-heavy dashboard.
 */
export function OperationsAppBoilerplate() {
  return (
    <DashboardShell
      appId="babysitter"
      title="BABYSITTER"
      icon="&#9880;"
      accent="#f59e0b"
      cards={
        <>
          <GlassCard title="Daemon">
            <StatusDot kind="success" label="running :4488" />
          </GlassCard>
          <GlassCard title="Workers">
            <StatusDot kind="running" label="4 active" pulse />
          </GlassCard>
          <GlassCard title="Last Proposal">
            <p style={{ fontSize: "0.75rem", color: "var(--pn-text-secondary)" }}>
              PRO-042 accepted 12 minutes ago
            </p>
            <div style={{ marginTop: "var(--pn-space-3)" }}>
              <GlassButton uiSize="sm" variant="ghost">
                View
              </GlassButton>
            </div>
          </GlassCard>
        </>
      }
    />
  );
}
