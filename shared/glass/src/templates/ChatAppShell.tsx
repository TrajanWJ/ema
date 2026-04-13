import type { ReactNode } from "react";
import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";
import type { WindowMode } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface ChatAppShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly mode?: WindowMode;
  /** The scrollable transcript area. */
  readonly transcript: ReactNode;
  /** The composer at the bottom (textarea + send). */
  readonly composer: ReactNode;
  /** Optional side panel (agent info, tool palette). */
  readonly sidebar?: ReactNode;
}

/**
 * ChatAppShell — operator-chat / agent-chat layout. Transcript scrolls,
 * composer pinned bottom, optional right sidebar. Uses grid so host code
 * doesn't need to hand-roll flexbox plumbing.
 */
export function ChatAppShell({
  appId,
  title,
  icon,
  accent,
  mode,
  transcript,
  composer,
  sidebar,
}: ChatAppShellProps) {
  const gridTemplate: string = sidebar
    ? "grid-cols-[1fr_240px]"
    : "grid-cols-[1fr]";
  // Grid template is rendered via inline style so we don't depend on Tailwind.
  const gridColumns: string = sidebar ? "1fr 240px" : "1fr";

  return (
    <AppWindowChrome
      appId={appId}
      title={title}
      icon={icon}
      accent={accent}
      mode={mode ?? "embedded"}
    >
      <div
        data-grid={gridTemplate}
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          height: "100%",
          gap: "var(--pn-space-3)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            height: "100%",
          }}
        >
          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            {transcript}
          </div>
          <div style={{ paddingTop: "var(--pn-space-3)" }}>{composer}</div>
        </div>
        {sidebar && (
          <aside
            style={{
              overflow: "auto",
              borderLeft: "1px solid var(--pn-border-subtle)",
              paddingLeft: "var(--pn-space-3)",
            }}
          >
            {sidebar}
          </aside>
        )}
      </div>
    </AppWindowChrome>
  );
}
