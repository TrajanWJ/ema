import type { ReactNode } from "react";

interface StandaloneAppShellProps {
  readonly title?: string;
  readonly centered?: boolean;
  readonly children: ReactNode;
}

export function StandaloneAppShell({
  title,
  centered = false,
  children,
}: StandaloneAppShellProps) {
  return (
    <div className="standalone-app-shell">
      {title && (
        <div className="standalone-app-shell__header" data-tauri-drag-region="">
          <span className="standalone-app-shell__title">{title}</span>
        </div>
      )}
      <main
        className={`standalone-app-shell__body ${centered ? "standalone-app-shell__body--centered" : ""}`.trim()}
      >
        {children}
      </main>
    </div>
  );
}
