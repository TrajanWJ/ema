import type { ReactNode } from "react";
import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";
import type { WindowMode } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface EditorShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly mode?: WindowMode;
  /** Toolbar row above the editor. Buttons, status, breadcrumbs. */
  readonly toolbar?: ReactNode;
  /** The editor surface (tiptap, monaco, etc). Fills remaining height. */
  readonly editor: ReactNode;
  /** Optional inspector column on the right. */
  readonly inspector?: ReactNode;
  /** Optional status strip at the bottom. */
  readonly statusBar?: ReactNode;
}

/**
 * EditorShell — journal / notes / whiteboard / canvas layout. Thin toolbar,
 * main editor area that takes all remaining space, optional right inspector
 * and bottom status strip.
 */
export function EditorShell({
  appId,
  title,
  icon,
  accent,
  mode,
  toolbar,
  editor,
  inspector,
  statusBar,
}: EditorShellProps) {
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
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
        }}
      >
        {toolbar && (
          <div
            style={{
              borderBottom: "1px solid var(--pn-border-subtle)",
              paddingBottom: "var(--pn-space-2)",
              marginBottom: "var(--pn-space-2)",
              display: "flex",
              alignItems: "center",
              gap: "var(--pn-space-2)",
            }}
          >
            {toolbar}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: inspector ? "1fr 280px" : "1fr",
            gap: "var(--pn-space-3)",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div style={{ overflow: "auto", minHeight: 0 }}>{editor}</div>
          {inspector && (
            <aside
              style={{
                overflow: "auto",
                borderLeft: "1px solid var(--pn-border-subtle)",
                paddingLeft: "var(--pn-space-3)",
              }}
            >
              {inspector}
            </aside>
          )}
        </div>
        {statusBar && (
          <div
            style={{
              borderTop: "1px solid var(--pn-border-subtle)",
              paddingTop: "var(--pn-space-2)",
              marginTop: "var(--pn-space-2)",
              fontSize: "0.65rem",
              color: "var(--pn-text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "var(--pn-space-3)",
            }}
          >
            {statusBar}
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
