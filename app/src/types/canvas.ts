export interface Canvas {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly canvas_type: string;
  readonly viewport?: { x: number; y: number; zoom: number };
  readonly settings?: { grid: boolean; snap: boolean };
  readonly project_id: string | null;
  readonly created_at: string;
}

export interface CanvasElement {
  readonly id: string;
  readonly element_type: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly z_index: number;
  readonly locked: boolean;
  readonly style: Record<string, unknown>;
  readonly text: string | null;
  readonly data_source: string | null;
  readonly data_config: Record<string, unknown>;
  readonly chart_config: Record<string, unknown>;
  readonly refresh_interval: number | null;
  readonly group_id?: string | null;
  readonly canvas_id?: string;
  /** Live data pushed from the server for data-bound elements */
  readonly live_data?: unknown;
}

export interface CanvasTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string;
  readonly layout_json: string;
  readonly thumbnail: string | null;
  readonly created_at: string;
}

export type ElementType =
  | "rectangle"
  | "ellipse"
  | "text"
  | "sticky"
  | "bar_chart"
  | "line_chart"
  | "pie_chart"
  | "sparkline"
  | "number_card"
  | "gauge"
  | "scatter"
  | "heatmap"
  | "connection";

export const ELEMENT_TYPES: readonly ElementType[] = [
  "rectangle",
  "ellipse",
  "text",
  "sticky",
  "bar_chart",
  "line_chart",
  "pie_chart",
  "sparkline",
  "number_card",
  "gauge",
  "scatter",
  "heatmap",
  "connection",
] as const;

export const DATA_SOURCES = [
  "tasks:by_status",
  "tasks:by_project",
  "tasks:completed_over_time",
  "proposals:by_confidence",
  "proposals:approval_rate",
  "habits:completion_rate",
  "habits:streaks",
  "responsibilities:health",
  "sessions:token_usage",
  "sessions:by_project",
  "vault:notes_by_space",
  "vault:link_density",
] as const;
