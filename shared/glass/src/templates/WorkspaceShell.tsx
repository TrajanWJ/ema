import type { ReactNode } from "react";

import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";
import type { WindowMode } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface WorkspaceShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly mode?: WindowMode;
  readonly nav: ReactNode;
  readonly hero?: ReactNode;
  readonly content: ReactNode;
  readonly rail?: ReactNode;
}

export function WorkspaceShell({
  appId,
  title,
  icon,
  accent,
  mode,
  nav,
  hero,
  content,
  rail,
}: WorkspaceShellProps) {
  return (
    <AppWindowChrome
      appId={appId}
      title={title}
      icon={icon}
      accent={accent}
      mode={mode ?? "embedded"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)", height: "100%" }}>
        {nav}
        {hero}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: rail ? "minmax(0, 1fr) var(--pn-layout-rail-width-md)" : "minmax(0, 1fr)",
            gap: "var(--pn-space-4)",
            minHeight: 0,
            flex: 1,
          }}
        >
          <section style={{ minWidth: 0, minHeight: 0, overflow: "auto" }}>{content}</section>
          {rail && <aside style={{ minHeight: 0, overflow: "auto" }}>{rail}</aside>}
        </div>
      </div>
    </AppWindowChrome>
  );
}
