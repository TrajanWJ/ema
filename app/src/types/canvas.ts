export interface Canvas {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly canvas_type: string;
  readonly project_id: string | null;
  readonly inserted_at: string;
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
  readonly style: Record<string, unknown>;
  readonly text: string | null;
  readonly data_source: string | null;
  readonly data_config: Record<string, unknown>;
  readonly chart_config: Record<string, unknown>;
  readonly refresh_interval: number | null;
}
