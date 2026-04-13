import type { ReactNode } from "react";
import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";
import type { WindowMode } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface DashboardShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly mode?: WindowMode;
  /** Grid of cards. Host decides how many columns; the shell wraps. */
  readonly cards: ReactNode;
  /** Optional hero block above the grid. */
  readonly hero?: ReactNode;
  /** Min card width in px. Default 280. */
  readonly minCardWidth?: number;
}

/**
 * DashboardShell — CSS grid of auto-sized GlassCards. Pairs with
 * life-dashboard / service-dashboard / hq overview vApps.
 */
export function DashboardShell({
  appId,
  title,
  icon,
  accent,
  mode,
  cards,
  hero,
  minCardWidth = 280,
}: DashboardShellProps) {
  return (
    <AppWindowChrome
      appId={appId}
      title={title}
      icon={icon}
      accent={accent}
      mode={mode ?? "embedded"}
    >
      {hero && <div style={{ marginBottom: "var(--pn-space-4)" }}>{hero}</div>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`,
          gap: "var(--pn-space-4)",
        }}
      >
        {cards}
      </div>
    </AppWindowChrome>
  );
}
