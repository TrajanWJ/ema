import type { ReactNode } from "react";

import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface CatalogShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly nav: ReactNode;
  readonly hero?: ReactNode;
  readonly browse: ReactNode;
  readonly content: ReactNode;
  readonly rail?: ReactNode;
}

export function CatalogShell({
  appId,
  title,
  icon,
  accent,
  nav,
  hero,
  browse,
  content,
  rail,
}: CatalogShellProps) {
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
        {hero}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: rail
              ? "var(--pn-layout-sidebar-width) minmax(0, 1fr) var(--pn-layout-rail-width-md)"
              : "var(--pn-layout-sidebar-width) minmax(0, 1fr)",
            gap: "var(--pn-space-4)",
            minHeight: 0,
            flex: 1,
          }}
        >
          <aside style={{ minHeight: 0, overflow: "auto" }}>{browse}</aside>
          <section style={{ minHeight: 0, overflow: "auto", minWidth: 0 }}>{content}</section>
          {rail && <aside style={{ minHeight: 0, overflow: "auto" }}>{rail}</aside>}
        </div>
      </div>
    </AppWindowChrome>
  );
}
