import type { ReactNode } from "react";

import { WorkspaceShell } from "./WorkspaceShell.tsx";

interface CommandCenterShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly nav: ReactNode;
  readonly hero?: ReactNode;
  readonly metrics?: ReactNode;
  readonly content: ReactNode;
  readonly rail?: ReactNode;
}

export function CommandCenterShell({
  nav,
  hero,
  metrics,
  content,
  rail,
  ...rest
}: CommandCenterShellProps) {
  return (
    <WorkspaceShell
      {...rest}
      nav={nav}
      hero={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)" }}>
          {hero}
          {metrics}
        </div>
      }
      content={content}
      rail={rail}
    />
  );
}
