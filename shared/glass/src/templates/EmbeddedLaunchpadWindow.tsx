import type { ReactNode } from "react";
import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface EmbeddedLaunchpadWindowProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly breadcrumb?: string;
  readonly children: ReactNode;
}

/**
 * EmbeddedLaunchpadWindow — pre-locked to mode="embedded". Use when a vApp
 * is always mounted inside the launchpad Shell and never breaks out.
 */
export function EmbeddedLaunchpadWindow(props: EmbeddedLaunchpadWindowProps) {
  return <AppWindowChrome mode="embedded" {...props} />;
}
