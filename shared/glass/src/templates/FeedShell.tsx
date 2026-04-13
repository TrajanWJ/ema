import type { ReactNode } from "react";

import { WorkspaceShell } from "./WorkspaceShell.tsx";

interface FeedShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly nav: ReactNode;
  readonly hero?: ReactNode;
  readonly spotlight?: ReactNode;
  readonly stream: ReactNode;
  readonly inspector?: ReactNode;
  readonly rail?: ReactNode;
}

export function FeedShell({
  nav,
  hero,
  spotlight,
  stream,
  inspector,
  rail,
  ...rest
}: FeedShellProps) {
  return (
    <WorkspaceShell
      {...rest}
      nav={nav}
      hero={hero}
      rail={rail}
      content={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)", minHeight: "100%" }}>
          {spotlight && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: inspector ? "minmax(0, 1.45fr) minmax(18rem, 0.9fr)" : "minmax(0, 1fr)",
                gap: "var(--pn-space-4)",
              }}
            >
              <div>{spotlight}</div>
              {inspector && <div>{inspector}</div>}
            </div>
          )}
          <div style={{ minHeight: 0 }}>{stream}</div>
        </div>
      }
    />
  );
}
