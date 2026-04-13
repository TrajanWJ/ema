import { getDb } from '../../persistence/db.js';

export interface WindowState {
  app_id: string;
  is_open: boolean;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  is_maximized: boolean;
}

interface WindowRow {
  app_id: string;
  is_open: number;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  is_maximized: number;
}

export interface UpdateWindowInput {
  is_open?: boolean | undefined;
  x?: number | null | undefined;
  y?: number | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  is_maximized?: boolean | undefined;
}

function mapWindow(row: WindowRow): WindowState {
  return {
    app_id: row.app_id,
    is_open: row.is_open === 1,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    is_maximized: row.is_maximized === 1,
  };
}

export function listWindows(): WindowState[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT app_id, is_open, x, y, width, height, is_maximized FROM workspace_windows ORDER BY app_id')
    .all() as WindowRow[];
  return rows.map(mapWindow);
}

export function getWindow(appId: string): WindowState | null {
  const db = getDb();
  const row = db
    .prepare('SELECT app_id, is_open, x, y, width, height, is_maximized FROM workspace_windows WHERE app_id = ?')
    .get(appId) as WindowRow | undefined;
  return row ? mapWindow(row) : null;
}

export function upsertWindow(appId: string, input: UpdateWindowInput): WindowState {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getWindow(appId);
  const next: WindowState = {
    app_id: appId,
    is_open: input.is_open ?? existing?.is_open ?? false,
    x: input.x === undefined ? (existing?.x ?? null) : input.x,
    y: input.y === undefined ? (existing?.y ?? null) : input.y,
    width: input.width === undefined ? (existing?.width ?? null) : input.width,
    height: input.height === undefined ? (existing?.height ?? null) : input.height,
    is_maximized: input.is_maximized ?? existing?.is_maximized ?? false,
  };

  db.prepare(
    `
      INSERT INTO workspace_windows (
        app_id, is_open, x, y, width, height, is_maximized, inserted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id) DO UPDATE SET
        is_open = excluded.is_open,
        x = excluded.x,
        y = excluded.y,
        width = excluded.width,
        height = excluded.height,
        is_maximized = excluded.is_maximized,
        updated_at = excluded.updated_at
    `,
  ).run(
    next.app_id,
    next.is_open ? 1 : 0,
    next.x,
    next.y,
    next.width,
    next.height,
    next.is_maximized ? 1 : 0,
    now,
    now,
  );

  return getWindow(appId) as WindowState;
}
