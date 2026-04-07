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

// EMA UI 2.0 — 27 apps (was 73)
export const APP_CONFIGS: Record<string, WindowConfig> = {
  // ── Core Workflow ──
  "brain-dump": {
    title: "Brain Dump", defaultWidth: 600, defaultHeight: 700,
    minWidth: 480, minHeight: 400, accent: "#6b95f0", icon: "◎",
  },
  tasks: {
    title: "Tasks", defaultWidth: 900, defaultHeight: 700,
    minWidth: 700, minHeight: 500, accent: "#6b95f0", icon: "☐",
  },
  projects: {
    title: "Projects", defaultWidth: 900, defaultHeight: 700,
    minWidth: 700, minHeight: 500, accent: "#2dd4a8", icon: "▣",
  },
  executions: {
    title: "Executions", defaultWidth: 1000, defaultHeight: 750,
    minWidth: 800, minHeight: 600, accent: "#818cf8", icon: "⚡",
  },
  proposals: {
    title: "Proposals", defaultWidth: 900, defaultHeight: 700,
    minWidth: 700, minHeight: 500, accent: "#a78bfa", icon: "◆",
  },

  // ── Intelligence ──
  "intent-schematic": {
    title: "Intent Schematic", defaultWidth: 1200, defaultHeight: 800,
    minWidth: 900, minHeight: 600, accent: "#a78bfa", icon: "🗺️",
  },
  wiki: {
    title: "Wiki", defaultWidth: 1000, defaultHeight: 750,
    minWidth: 800, minHeight: 600, accent: "#60a5fa", icon: "📖",
  },
  agents: {
    title: "Agents", defaultWidth: 900, defaultHeight: 700,
    minWidth: 700, minHeight: 500, accent: "#a78bfa", icon: "⊞",
  },

  // ── Creative ──
  canvas: {
    title: "Canvas", defaultWidth: 1100, defaultHeight: 800,
    minWidth: 900, minHeight: 650, accent: "#6b95f0", icon: "◧",
  },
  pipes: {
    title: "Pipes", defaultWidth: 900, defaultHeight: 700,
    minWidth: 700, minHeight: 500, accent: "#a78bfa", icon: "⟿",
  },
  evolution: {
    title: "Evolution", defaultWidth: 900, defaultHeight: 700,
    minWidth: 700, minHeight: 500, accent: "#c084fc", icon: "⦖",
  },

  // ── Operations ──
  "decision-log": {
    title: "Decision Log", defaultWidth: 1000, defaultHeight: 700,
    minWidth: 800, minHeight: 550, accent: "#c084fc", icon: "⚖",
  },
  campaigns: {
    title: "Campaigns", defaultWidth: 950, defaultHeight: 700,
    minWidth: 800, minHeight: 500, accent: "#8b5cf6", icon: "🎯",
  },

  // ── Life ──
  habits: {
    title: "Habits", defaultWidth: 650, defaultHeight: 700,
    minWidth: 500, minHeight: 400, accent: "#2dd4a8", icon: "↻",
  },
  journal: {
    title: "Journal", defaultWidth: 800, defaultHeight: 700,
    minWidth: 600, minHeight: 500, accent: "#f59e0b", icon: "✎",
  },
  focus: {
    title: "Focus", defaultWidth: 700, defaultHeight: 650,
    minWidth: 500, minHeight: 450, accent: "#f43f5e", icon: "⏱",
  },
  responsibilities: {
    title: "Responsibilities", defaultWidth: 800, defaultHeight: 650,
    minWidth: 600, minHeight: 450, accent: "#f59e0b", icon: "⚈",
  },
  temporal: {
    title: "Rhythm", defaultWidth: 800, defaultHeight: 650,
    minWidth: 700, minHeight: 500, accent: "#f97316", icon: "⏱",
  },
  goals: {
    title: "Goals", defaultWidth: 800, defaultHeight: 700,
    minWidth: 600, minHeight: 500, accent: "#f59e0b", icon: "◎",
  },

  // ── System ──
  settings: {
    title: "Settings", defaultWidth: 600, defaultHeight: 600,
    minWidth: 500, minHeight: 400, accent: "rgba(255,255,255,0.50)", icon: "⚙",
  },
  voice: {
    title: "Voice", defaultWidth: 900, defaultHeight: 700,
    minWidth: 700, minHeight: 500, accent: "#00D2FF", icon: "◯",
  },
} as const;
