/**
 * VaultSeeder — scan a markdown vault for seedable proposal material.
 *
 * Ports `Ema.Proposals.VaultSeeder` from the old Elixir build
 * (IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/proposals/vault_seeder.ex).
 *
 * Finds three kinds of lines across every `*.md` under `vaultRoot`:
 *   - `TODO:` / `FIXME:`   -> kind: 'todo'
 *   - `- [ ] ...`          -> kind: 'unchecked_checkbox'
 *   - `IDEA:` / `:idea:`   -> kind: 'marked_idea'
 *
 * Inline `#tag` tokens on the matching line are harvested into `tags`.
 *
 * Pure logic: no dependency on Pipes, Blueprint, or the persistence layer.
 * If the caller wants to stream results onto an event bus, they pass an
 * `emit` callback to the constructor and it fires once per produced seed.
 *
 * Watcher mode uses `fs.watch` (node built-in) so we don't pull chokidar.
 */

import type { Dirent } from "node:fs";
import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs";
import { join, relative, sep } from "node:path";

import { nanoid } from "nanoid";

export type VaultSeedKind = "todo" | "unchecked_checkbox" | "marked_idea";

export interface VaultSeed {
  id: string;
  text: string;
  source_file: string;
  line: number;
  kind: VaultSeedKind;
  tags: string[];
  extracted_at: string;
}

export interface VaultSeederOptions {
  vaultRoot: string;
  emit?: (seed: VaultSeed) => void;
}

export interface ScanOptions {
  since?: string;
  limit?: number;
}

const IGNORED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  ".git",
  "archive",
  "Archive",
]);

const TODO_PATTERN = /(?:^|\s)(TODO|FIXME):\s*(.+)$/u;
const CHECKBOX_PATTERN = /^\s*-\s+\[\s\]\s+(.+)$/u;
const IDEA_PATTERN = /(?:^|\s)(?:IDEA:|:idea:)\s*(.+)$/u;
const TAG_PATTERN = /(?:^|\s)#([A-Za-z0-9][\w-]*)/gu;

export class VaultSeeder {
  private readonly vaultRoot: string;
  private readonly emit?: (seed: VaultSeed) => void;

  constructor(opts: VaultSeederOptions) {
    this.vaultRoot = opts.vaultRoot;
    if (opts.emit) this.emit = opts.emit;
  }

  async scan(opts: ScanOptions = {}): Promise<VaultSeed[]> {
    const sinceMs = opts.since ? Date.parse(opts.since) : Number.NaN;
    const hasSince = Number.isFinite(sinceMs);
    const limit = typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : Infinity;

    const seeds: VaultSeed[] = [];
    const files = await this.listMarkdownFiles(this.vaultRoot);

    for (const file of files) {
      if (seeds.length >= limit) break;

      if (hasSince) {
        try {
          const stat = await fs.stat(file);
          if (stat.mtimeMs < sinceMs) continue;
        } catch {
          continue;
        }
      }

      const extracted = await this.extractFromFile(file);
      for (const seed of extracted) {
        if (seeds.length >= limit) break;
        seeds.push(seed);
        this.emit?.(seed);
      }
    }

    return seeds;
  }

  /**
   * Start a long-lived watcher. Returns a stop function.
   *
   * Uses `fs.watch` recursively where supported (macOS, Windows). On Linux
   * `recursive` is a no-op and callers get top-level events only — we still
   * return a stop handle so tests and callers can clean up deterministically.
   */
  async watch(): Promise<() => void> {
    let watcher: FSWatcher | null = null;
    try {
      watcher = fsWatch(
        this.vaultRoot,
        { recursive: true, persistent: false, encoding: "utf8" },
        (_event, filename) => {
          if (filename === null) return;
          if (!filename.endsWith(".md")) return;
          const abs = join(this.vaultRoot, filename);
          void this.extractFromFile(abs).then((seeds) => {
            if (!this.emit) return;
            for (const seed of seeds) this.emit(seed);
          });
        },
      );
    } catch {
      watcher = null;
    }

    return () => {
      if (watcher) watcher.close();
    };
  }

  // -- internals ----------------------------------------------------------

  private async listMarkdownFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    await this.walk(root, out);
    return out;
  }

  private async walk(dir: string, out: string[]): Promise<void> {
    let entries: Dirent[];
    try {
      entries = (await fs.readdir(dir, { withFileTypes: true })) as Dirent[];
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_SEGMENTS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(full, out);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }

  private async extractFromFile(file: string): Promise<VaultSeed[]> {
    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      return [];
    }

    const seeds: VaultSeed[] = [];
    const lines = content.split(/\r?\n/u);
    const relPath = this.toRelative(file);
    const now = new Date().toISOString();

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (typeof raw !== "string") continue;
      const line = raw;
      const lineNumber = i + 1;

      const matched = matchLine(line);
      if (!matched) continue;

      seeds.push({
        id: nanoid(),
        text: matched.text,
        source_file: relPath,
        line: lineNumber,
        kind: matched.kind,
        tags: extractTags(line),
        extracted_at: now,
      });
    }

    return seeds;
  }

  private toRelative(absolute: string): string {
    const rel = relative(this.vaultRoot, absolute);
    if (rel.startsWith(`..${sep}`) || rel === "..") return absolute;
    return rel.length > 0 ? rel : absolute;
  }
}

interface MatchedLine {
  kind: VaultSeedKind;
  text: string;
}

function matchLine(line: string): MatchedLine | null {
  const checkbox = CHECKBOX_PATTERN.exec(line);
  if (checkbox?.[1]) {
    return { kind: "unchecked_checkbox", text: checkbox[1].trim() };
  }

  const todo = TODO_PATTERN.exec(line);
  if (todo?.[2]) {
    return { kind: "todo", text: todo[2].trim() };
  }

  const idea = IDEA_PATTERN.exec(line);
  if (idea?.[1]) {
    return { kind: "marked_idea", text: idea[1].trim() };
  }

  return null;
}

function extractTags(line: string): string[] {
  const tags = new Set<string>();
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(line)) !== null) {
    if (match[1]) tags.add(match[1]);
  }
  return Array.from(tags);
}
