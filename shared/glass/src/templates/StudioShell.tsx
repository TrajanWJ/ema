import type { ReactNode } from "react";

import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";
import type { WindowMode } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface StudioShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly mode?: WindowMode;
  readonly topBar?: ReactNode;
  readonly canvas: ReactNode;
  readonly inspector?: ReactNode;
}

export function StudioShell({
  appId,
  title,
  icon,
  accent,
  mode,
  topBar,
  canvas,
  inspector,
}: StudioShellProps) {
  return (
    <AppWindowChrome
      appId={appId}
      title={title}
      icon={icon}
      accent={accent}
      mode={mode ?? "embedded"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)", height: "100%" }}>
        {topBar}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: inspector ? "minmax(0, 1fr) var(--pn-layout-inspector-width)" : "minmax(0, 1fr)",
            gap: "var(--pn-space-4)",
            minHeight: 0,
            flex: 1,
          }}
        >
          <section style={{ minWidth: 0, minHeight: 0, overflow: "auto" }}>{canvas}</section>
          {inspector && <aside style={{ minHeight: 0, overflow: "auto" }}>{inspector}</aside>}
        </div>
      </div>
    </AppWindowChrome>
  );
}
