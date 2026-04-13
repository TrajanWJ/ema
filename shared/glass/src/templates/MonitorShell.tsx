import type { ReactNode } from "react";

import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface MonitorShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly nav?: ReactNode;
  readonly summary?: ReactNode;
  readonly panels: ReactNode;
  readonly events?: ReactNode;
}

export function MonitorShell({
  appId,
  title,
  icon,
  accent,
  nav,
  summary,
  panels,
  events,
}: MonitorShellProps) {
  return (
    <AppWindowChrome
      appId={appId}
      title={title}
      icon={icon}
      accent={accent}
      mode="embedded"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)", height: "100%" }}>
        {nav}
        {summary}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: events ? "minmax(0, 1fr) var(--pn-layout-rail-width-md)" : "minmax(0, 1fr)",
            gap: "var(--pn-space-4)",
            minHeight: 0,
            flex: 1,
          }}
        >
          <section style={{ minHeight: 0, overflow: "auto" }}>{panels}</section>
          {events && <aside style={{ minHeight: 0, overflow: "auto" }}>{events}</aside>}
        </div>
      </div>
    </AppWindowChrome>
  );
}
