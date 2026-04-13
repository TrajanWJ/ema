import { getDb } from '../../persistence/db.js';
import type { Setting, UpsertSettingInput } from './settings.schema.js';

export function getAllSettings(): Setting[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
  return rows as Setting[];
}

export function getSetting(key: string): Setting | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
  return row as Setting | undefined;
}

export function upsertSetting(input: UpsertSettingInput): Setting {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare('SELECT id FROM settings WHERE key = ?')
    .get(input.key) as { id: number } | undefined;

  if (existing) {
    db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(
      input.value,
      now,
      input.key,
    );
  } else {
    db.prepare(
      'INSERT INTO settings (key, value, inserted_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run(input.key, input.value, now, now);
  }

  return getSetting(input.key) as Setting;
}
