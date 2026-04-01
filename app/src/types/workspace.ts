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
  proposals: {
    title: "Proposals",
    defaultWidth: 900,
    defaultHeight: 700,
    minWidth: 700,
    minHeight: 500,
    accent: "#a78bfa",
    icon: "\u25C6",
  },
  projects: {
    title: "Projects",
    defaultWidth: 900,
    defaultHeight: 700,
    minWidth: 700,
    minHeight: 500,
    accent: "#2dd4a8",
    icon: "\u25A3",
  },
  tasks: {
    title: "Tasks",
    defaultWidth: 900,
    defaultHeight: 700,
    minWidth: 700,
    minHeight: 500,
    accent: "#6b95f0",
    icon: "\u2610",
  },
  responsibilities: {
    title: "Responsibilities",
    defaultWidth: 800,
    defaultHeight: 650,
    minWidth: 600,
    minHeight: 450,
    accent: "#f59e0b",
    icon: "\u26E8",
  },
  agents: {
    title: "Agents",
    defaultWidth: 900,
    defaultHeight: 700,
    minWidth: 700,
    minHeight: 500,
    accent: "#a78bfa",
    icon: "\u2B21",
  },
  vault: {
    title: "Second Brain",
    defaultWidth: 1000,
    defaultHeight: 750,
    minWidth: 800,
    minHeight: 600,
    accent: "#2dd4a8",
    icon: "\u25C8",
  },
  canvas: {
    title: "Canvas",
    defaultWidth: 1100,
    defaultHeight: 800,
    minWidth: 900,
    minHeight: 650,
    accent: "#6b95f0",
    icon: "\u25E7",
  },
  pipes: {
    title: "Pipes",
    defaultWidth: 900,
    defaultHeight: 700,
    minWidth: 700,
    minHeight: 500,
    accent: "#a78bfa",
    icon: "\u27BF",
  },
  settings: {
    title: "Settings",
    defaultWidth: 600,
    defaultHeight: 600,
    minWidth: 500,
    minHeight: 400,
    accent: "rgba(255,255,255,0.50)",
    icon: "\u2699",
  },
  "channels": {
    title: "Channels",
    defaultWidth: 1100,
    defaultHeight: 750,
    minWidth: 900,
    minHeight: 600,
    accent: "#5865F2",
    icon: "\uD83D\uDCAC",
  },
  "metamind": {
    title: "MetaMind",
    defaultWidth: 1000,
    defaultHeight: 750,
    minWidth: 800,
    minHeight: 600,
    accent: "#e879f9",
    icon: "\u29BF",
  },
  evolution: {
    title: "Evolution",
    defaultWidth: 900,
    defaultHeight: 700,
    minWidth: 700,
    minHeight: 500,
    accent: "#c084fc",
    icon: "\u29D6",
  },
  "claude-bridge": {
    title: "Claude Bridge",
    defaultWidth: 1000,
    defaultHeight: 700,
    minWidth: 800,
    minHeight: 550,
    accent: "#a78bfa",
    icon: "\u2B23",
  },
} as const;

