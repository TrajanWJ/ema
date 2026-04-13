import { useMemo } from "react";
import type { WindowMode } from "../components/AppWindowChrome/AppWindowChrome.tsx";

interface WindowChromeHandlers {
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

interface UseWindowChromeOptions extends WindowChromeHandlers {
  /**
   * Explicit mode override. If omitted, detect via the URL query (`?standalone`)
   * which the old build used, falling back to "embedded".
   */
  readonly mode?: WindowMode;
}

interface UseWindowChromeReturn extends Required<Pick<UseWindowChromeOptions, "mode">> {
  readonly handlers: WindowChromeHandlers;
}

/**
 * useWindowChrome — resolves window mode (embedded vs standalone) and
 * bundles the callback handlers. Matches the old isInsideLaunchpad() trick:
 * a `?standalone` query flag means we are our own BrowserWindow.
 */
export function useWindowChrome(
  options: UseWindowChromeOptions = {},
): UseWindowChromeReturn {
  return useMemo(() => {
    const mode: WindowMode = options.mode ?? detectMode();
    const handlers: WindowChromeHandlers = {};
    if (options.onMinimize) handlers.onMinimize = options.onMinimize;
    if (options.onMaximize) handlers.onMaximize = options.onMaximize;
    if (options.onClose) handlers.onClose = options.onClose;
    return { mode, handlers };
  }, [options.mode, options.onMinimize, options.onMaximize, options.onClose]);
}

function detectMode(): WindowMode {
  if (typeof window === "undefined") return "embedded";
  return window.location.search.includes("standalone") ? "standalone" : "embedded";
}
