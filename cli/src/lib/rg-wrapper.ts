// rg-wrapper.ts
//
// Spawn ripgrep as a subprocess. We use `--json` which emits a stream of
// newline-delimited JSON objects (one per match + summary). We parse them
// into a simple typed shape the commands can render.
//
// Why not a JS ripgrep binding? Because ripgrep's speed is the point — we
// want to preserve its native binary cost model. Shelling out is fine for
// the CLI; if a daemon needs in-process search later, revisit.
//
// Failure mode: if `rg` isn't on PATH, we want a clean message, not a
// stack trace. `spawnSync.error` will be an ENOENT — we surface that as a
// helpful "please install ripgrep" error so the user knows what to fix.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export interface RipgrepHit {
  /** Absolute path. */
  readonly path: string;
  /** 1-indexed line number. */
  readonly line: number;
  /** The matched line, trimmed. */
  readonly text: string;
}

export class RipgrepMissingError extends Error {
  public override readonly name = 'RipgrepMissingError';
}

/**
 * Run ripgrep and return matches. `paths` is the list of directories/files
 * to scan. An empty `paths` array is a no-op (returns []).
 *
 * Options are deliberately minimal — add flags as commands need them.
 */
export function runRipgrep(
  pattern: string,
  paths: readonly string[],
  options: { maxCount?: number; hidden?: boolean } = {},
): readonly RipgrepHit[] {
  if (paths.length === 0) return [];

  // Keep only paths that exist. rg errors on missing, and we don't want
  // a grep into _extractions/ to fail just because clones/ hasn't been
  // populated yet.
  const real = paths.filter((p) => existsSync(p));
  if (real.length === 0) return [];

  const args = ['--json', '--no-messages'];
  if (options.hidden) args.push('--hidden');
  if (typeof options.maxCount === 'number') {
    args.push('-m', String(options.maxCount));
  }
  args.push('--', pattern, ...real);

  let result;
  try {
    result = spawnSync('rg', args, {
      encoding: 'utf8',
      // 10MB buffer — ripgrep can produce a lot of JSON for common terms.
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    throw wrapRgError(err);
  }

  // spawnSync returns an error via `result.error` for ENOENT, not by throwing.
  if (result.error) {
    throw wrapRgError(result.error);
  }

  // rg exit: 0 = matches, 1 = no matches, 2 = error.
  if (result.status === 2) {
    const stderr = (result.stderr || '').toString().trim();
    throw new Error(`rg failed: ${stderr || 'unknown error'}`);
  }

  const stdout = result.stdout || '';
  return parseJsonStream(stdout);
}

/** Translate Node's ENOENT into a friendly install prompt. */
function wrapRgError(err: unknown): Error {
  if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
    return new RipgrepMissingError(
      'ripgrep (rg) is not installed or not on PATH. Install with:\n' +
        '  apt install ripgrep    # Debian/Ubuntu\n' +
        '  brew install ripgrep   # macOS\n' +
        '  pacman -S ripgrep      # Arch',
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Parse ripgrep's `--json` output. Each line is a JSON object with a `type`
 * field. We only care about `match` records; `begin`, `end`, `summary`, and
 * `context` are ignored.
 *
 * A match record looks like:
 *   { type: "match", data: {
 *     path: { text: "/abs/path" },
 *     lines: { text: "matched line\n" },
 *     line_number: 42,
 *     ...
 *   } }
 */
function parseJsonStream(stdout: string): readonly RipgrepHit[] {
  const hits: RipgrepHit[] = [];
  const lines = stdout.split('\n');
  for (const line of lines) {
    if (line.length === 0) continue;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // skip malformed lines — usually truncated tails
    }
    if (!isMatchRecord(record)) continue;
    const data = record.data;
    const path = stringOrEmpty(data.path?.text);
    const text = stringOrEmpty(data.lines?.text).replace(/\r?\n$/, '').trim();
    const lineNo = typeof data.line_number === 'number' ? data.line_number : 0;
    if (path.length === 0) continue;
    hits.push({ path, line: lineNo, text });
  }
  return hits;
}

// Runtime type guard for the ripgrep match record shape. Narrow enough for
// our use, permissive about anything we don't read.
type RgMatchRecord = {
  type: 'match';
  data: {
    path?: { text?: string };
    lines?: { text?: string };
    line_number?: number;
  };
};

function isMatchRecord(value: unknown): value is RgMatchRecord {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as { type?: unknown; data?: unknown };
  if (obj.type !== 'match') return false;
  if (typeof obj.data !== 'object' || obj.data === null) return false;
  return true;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
