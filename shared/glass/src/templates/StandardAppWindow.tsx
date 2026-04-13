import type { ReactNode } from "react";
import { AppWindowChrome } from "../components/AppWindowChrome/AppWindowChrome.tsx";
import type { WindowMode } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface StandardAppWindowProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly breadcrumb?: string;
  readonly mode?: WindowMode;
  readonly onMinimize?: () => void;
  readonly onMaximize?: () => void;
  readonly onClose?: () => void;
  readonly children: ReactNode;
}

/**
 * StandardAppWindow — the default vApp shell. Renders an AppWindowChrome with
 * the requested mode and drops children into the body. Use this as the
 * outermost wrapper for almost every vApp.
 */
export function StandardAppWindow(props: StandardAppWindowProps) {
  return <AppWindowChrome {...props} />;
}
