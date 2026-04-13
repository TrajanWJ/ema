import type { ReactNode } from "react";

import { WorkspaceShell } from "./WorkspaceShell.tsx";

interface InspectorWorkspaceShellProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly nav: ReactNode;
  readonly hero?: ReactNode;
  readonly content: ReactNode;
  readonly inspector: ReactNode;
}

export function InspectorWorkspaceShell({
  appId,
  title,
  icon,
  accent,
  nav,
  hero,
  content,
  inspector,
}: InspectorWorkspaceShellProps) {
  return (
    <WorkspaceShell
      appId={appId}
      title={title}
      icon={icon}
      accent={accent}
      nav={nav}
      hero={hero}
      content={content}
      rail={inspector}
    />
  );
}
