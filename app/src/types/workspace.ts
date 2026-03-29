export interface WindowState {
  readonly app_id: string;
  readonly is_open: boolean;
  readonly x: number | null;
  readonly y: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly is_maximized: boolean;
}

export interface WindowConfig {
  readonly title: string;
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly accent: string;
  readonly icon: string;
}

export const APP_CONFIGS: Record<string, WindowConfig> = {
  "brain-dump": {
    title: "Brain Dump",
    defaultWidth: 600,
    defaultHeight: 700,
    minWidth: 480,
    minHeight: 400,
    accent: "#6b95f0",
    icon: "◎",
  },
  habits: {
    title: "Habits",
    defaultWidth: 650,
    defaultHeight: 700,
    minWidth: 500,
    minHeight: 400,
    accent: "#2dd4a8",
    icon: "↻",
  },
  journal: {
    title: "Journal",
    defaultWidth: 800,
    defaultHeight: 700,
    minWidth: 600,
    minHeight: 500,
    accent: "#f59e0b",
    icon: "✎",
  },
  settings: {
    title: "Settings",
    defaultWidth: 600,
    defaultHeight: 600,
    minWidth: 500,
    minHeight: 400,
    accent: "rgba(255,255,255,0.50)",
    icon: "⚙",
  },
} as const;
