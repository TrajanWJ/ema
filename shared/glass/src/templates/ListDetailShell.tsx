import type { ReactNode } from "react";
import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";
import type { WindowMode } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface ListDetailShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly mode?: WindowMode;
  /** Left column: list of items. Host provides virtualization if needed. */
  readonly list: ReactNode;
  /** Right column: detail view of the selected item. */
  readonly detail: ReactNode;
  /** List column width in px. Default 280. */
  readonly listWidth?: number;
}

/**
 * ListDetailShell — tasks / proposals / intents / executions layout.
 * Fixed-width list on the left, flexible detail on the right.
 */
export function ListDetailShell({
  appId,
  title,
  icon,
  accent,
  mode,
  list,
  detail,
  listWidth = 280,
}: ListDetailShellProps) {
  return (
    <AppWindowChrome
      appId={appId}
      title={title}
      icon={icon}
      accent={accent}
      mode={mode ?? "embedded"}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${listWidth}px 1fr`,
          gap: "var(--pn-space-3)",
          height: "100%",
          minHeight: 0,
        }}
      >
        <aside
          style={{
            overflow: "auto",
            borderRight: "1px solid var(--pn-border-subtle)",
            paddingRight: "var(--pn-space-3)",
          }}
        >
          {list}
        </aside>
        <section style={{ overflow: "auto", minWidth: 0 }}>{detail}</section>
      </div>
    </AppWindowChrome>
  );
}
