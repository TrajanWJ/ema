export type WindowConfig = {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
};

export type WindowCategory = "standard" | "wide" | "compact" | "panel";

export const APP_WINDOW_DEFAULTS: Record<WindowCategory, WindowConfig> = {
  standard: { width: 1000, height: 700, minWidth: 600, minHeight: 400 },
  wide: { width: 1200, height: 800, minWidth: 800, minHeight: 500 },
  compact: { width: 600, height: 500, minWidth: 400, minHeight: 300 },
  panel: { width: 400, height: 600, minWidth: 300, minHeight: 400 },
};
