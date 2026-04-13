/**
 * Filesystem sync for the Blueprint subservice.
 *
 * Two mirror locations per DEC-004 + Self-Pollination Appendix A.6:
 *
 *   1. `.superman/gac/<NNN>/card.md`          — runtime two-layer location
 *   2. `ema-genesis/intents/GAC-<NNN>/README.md` — canonical source location
 *
 * Both are loadable; the canonical `ema-genesis/intents/...` location holds
 * the ten existing hand-authored cards and is the cold-boot index source.
 *
 * Parsing strategy:
 *
 * - YAML frontmatter is hand-parsed (the brief forbids installing
 *   `gray-matter`). The parser handles the flat scalar, inline list, and
 *   nested-block forms used by the existing cards.
 * - `question`, `options`, and `tags` are extracted from the markdown body
 *   because the hand-authored cards store them there, not in the frontmatter.
 * - Legacy shape fields (`resolution`, flat `answered_by`) are normalised
 *   into the canonical `GacCard` shape before validation.
 *
 * Watching uses `node:fs.watch` recursively. `chokidar` is not a dep of the
 * `services` workspace and the brief forbids adding dependencies. `fs.watch`
 * is debounced because Linux emits multiple events per save.
 */

import { EventEmitter } from "node:events";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { join, resolve } from "node:path";

import {
  gacCardSchema,
  type GacCard,
  type GacCategory,
  type GacConnection,
  type GacOption,
  type GacPriority,
  type GacResultAction,
  type GacStatus,
} from "@ema/shared/schemas";
import {
  softDeleteBySourcePath,
  upsertGacCardFromSource,
} from "./service.js";

export const filesystemEvents = new EventEmitter();

// -- YAML frontmatter parser (hand-rolled) --------------------------------

interface FrontmatterSplit {
  frontmatter: string;
  body: string;
}

function splitFrontmatter(source: string): FrontmatterSplit | null {
  if (!source.startsWith("---")) return null;
  const end = source.indexOf("\n---", 3);
  if (end === -1) return null;
  const frontmatter = source.slice(4, end);
  const body = source.slice(end + 4).replace(/^\r?\n/u, "");
  return { frontmatter, body };
}

type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseScalar(raw: string): YamlValue {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "~" || trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/u.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/u.test(trimmed)) return Number.parseFloat(trimmed);
  return stripQuotes(trimmed);
}

function parseInlineObject(raw: string): Record<string, YamlValue> {
  // Very small inline flow-style parser for `{ key: value, key: value }`.
  const inner = raw.trim().replace(/^\{/u, "").replace(/\}$/u, "");
  const out: Record<string, YamlValue> = {};
  // Split on commas not inside brackets/quotes.
  const parts: string[] = [];
  let depth = 0;
  let inString: string | null = null;
  let current = "";
  for (const ch of inner) {
    if (inString) {
      current += ch;
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      current += ch;
      continue;
    }
    if (ch === "{" || ch === "[") depth += 1;
    if (ch === "}" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current);
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim();
    const value = part.slice(colonIdx + 1);
    out[key] = parseScalar(value);
  }
  return out;
}

function parseInlineList(raw: string): YamlValue[] {
  const inner = raw.trim().replace(/^\[/u, "").replace(/\]$/u, "");
  if (inner.trim() === "") return [];
  return inner.split(",").map((part) => parseScalar(part));
}

/**
 * Minimal block-YAML parser. Handles the subset used by GAC card frontmatter:
 *
 *   key: scalar
 *   key: [a, b, c]
 *   key:
 *     - scalar
 *     - { target: "...", relation: "..." }
 */
function parseYaml(source: string): Record<string, YamlValue> {
  const lines = source.split(/\r?\n/u);
  const out: Record<string, YamlValue> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || line.trim().startsWith("#")) {
      i += 1;
      continue;
    }
    const match = /^([A-Za-z0-9_]+):(.*)$/u.exec(line);
    if (!match) {
      i += 1;
      continue;
    }
    const key = match[1] ?? "";
    const after = (match[2] ?? "").trim();
    if (after === "") {
      // Block list or block map follows.
      const items: YamlValue[] = [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i] ?? "";
        if (!/^\s+-\s/u.test(next)) break;
        const itemRaw = next.replace(/^\s+-\s/u, "").trim();
        if (itemRaw.startsWith("{")) {
          items.push(parseInlineObject(itemRaw));
        } else {
          items.push(parseScalar(itemRaw));
        }
        i += 1;
      }
      out[key] = items;
      continue;
    }
    if (after.startsWith("[")) {
      out[key] = parseInlineList(after);
    } else if (after.startsWith("{")) {
      out[key] = parseInlineObject(after);
    } else {
      out[key] = parseScalar(after);
    }
    i += 1;
  }
  return out;
}

// -- markdown body extraction ---------------------------------------------

function escapeRegex(input: string): string {
  return input.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

function extractSection(body: string, heading: string): string | null {
  const headingRegex = new RegExp(
    `^##\\s+${escapeRegex(heading)}\\s*$`,
    "imu",
  );
  const lines = body.split(/\r?\n/u);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (headingRegex.test(lines[i] ?? "")) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    if (/^##\s+/u.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

function extractQuestion(body: string): string {
  const q = extractSection(body, "Question");
  if (q && q.length > 0) return q;
  // Fallback: first non-empty paragraph after the title.
  const para = body.split(/\n\s*\n/u).find((p) => p.trim().length > 0);
  return (para ?? "").trim();
}

/**
 * Extract options from the Options section. The existing cards use bullets
 * like `- **[A] Title**: text` followed by `  - **Implications:** ...`.
 * Lossy but good enough for indexing — canonical source remains the markdown.
 */
function extractOptions(body: string): GacOption[] {
  const section = extractSection(body, "Options");
  if (!section) return [];
  const options: GacOption[] = [];
  const lines = section.split(/\r?\n/u);
  let current: { label: string; text: string; implications: string } | null =
    null;
  const labelRegex = /^-\s+\*\*\[([^\]]+)\]\s*([^*]*)\*\*:?\s*(.*)$/u;
  const implicationsRegex = /\*\*Implications:\*\*\s*(.*)$/u;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const labelMatch = labelRegex.exec(line.trim());
    if (labelMatch) {
      if (current) options.push(current);
      current = {
        label: (labelMatch[1] ?? "").trim(),
        text: `${(labelMatch[2] ?? "").trim()} ${(labelMatch[3] ?? "").trim()}`.trim(),
        implications: "",
      };
      continue;
    }
    if (current) {
      const impMatch = implicationsRegex.exec(line);
      if (impMatch) {
        current.implications = (impMatch[1] ?? "").trim();
      } else if (line.trim().startsWith("- ") === false && line.trim() !== "") {
        current.text = `${current.text} ${line.trim()}`.trim();
      }
    }
  }
  if (current) options.push(current);
  return options.filter((opt) => opt.label.length > 0);
}

function extractTagsFromBody(body: string): string[] {
  const trailing = body.split(/\r?\n/u).reverse();
  for (const line of trailing) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith("#") && !trimmed.startsWith("##")) {
      return trimmed
        .split(/\s+/u)
        .filter((part) => part.startsWith("#"))
        .map((part) => part.slice(1));
    }
    break;
  }
  return [];
}

// -- normalisation --------------------------------------------------------

function coerceConnections(value: YamlValue | undefined): GacConnection[] {
  if (!Array.isArray(value)) return [];
  const out: GacConnection[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      continue;
    const target = item.target;
    const relation = item.relation;
    if (typeof target === "string" && typeof relation === "string") {
      out.push({ target, relation });
    }
  }
  return out;
}

function coerceString(value: YamlValue | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function coerceStringOrUndefined(value: YamlValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function coerceStatus(value: YamlValue | undefined): GacStatus {
  const candidates: GacStatus[] = [
    "pending",
    "answered",
    "deferred",
    "promoted",
  ];
  if (typeof value === "string") {
    const found = candidates.find((s) => s === value);
    if (found) return found;
  }
  return "pending";
}

function coerceCategory(value: YamlValue | undefined): GacCategory {
  if (value === "gap" || value === "assumption" || value === "clarification") {
    return value;
  }
  return "gap";
}

function coercePriority(value: YamlValue | undefined): GacPriority {
  if (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
  ) {
    return value;
  }
  return "medium";
}

function normaliseDate(value: YamlValue | undefined, fallback: string): string {
  if (typeof value === "string") {
    if (/T\d{2}:\d{2}/u.test(value)) return value;
    // Bare date like "2026-04-12" → midnight UTC.
    if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return `${value}T00:00:00Z`;
  }
  return fallback;
}

export interface ParsedGacCard {
  card: GacCard;
  rawFrontmatter: Record<string, YamlValue>;
}

export function parseGacCardFile(content: string): ParsedGacCard | null {
  const split = splitFrontmatter(content);
  if (!split) return null;
  const fm = parseYaml(split.frontmatter);

  const id = coerceString(fm.id, "");
  if (!/^GAC-\d{3,}$/u.test(id)) return null;

  const created = normaliseDate(fm.created, "2026-01-01T00:00:00Z");
  const updated = normaliseDate(fm.updated, created);

  const question = extractQuestion(split.body);
  const options = extractOptions(split.body);
  const tags = extractTagsFromBody(split.body);

  const candidate: Record<string, unknown> = {
    id,
    type: "gac_card",
    layer: "intents",
    title: coerceString(fm.title, id),
    status: coerceStatus(fm.status),
    created,
    updated,
    author: coerceString(fm.author, "unknown"),
    category: coerceCategory(fm.category),
    priority: coercePriority(fm.priority),
    question: question.length > 0 ? question : coerceString(fm.title, id),
    options,
    connections: coerceConnections(fm.connections),
    tags,
  };

  const answeredAt = coerceStringOrUndefined(fm.answered_at);
  if (answeredAt) candidate.answered_at = normaliseDate(answeredAt, answeredAt);
  const answeredBy = coerceStringOrUndefined(fm.answered_by);
  if (answeredBy) candidate.answered_by = answeredBy;

  // Synthesize an `answer` object if the legacy card has enough signal.
  if (answeredBy && answeredAt) {
    const resolution = coerceStringOrUndefined(fm.resolution);
    const answer = {
      selected: resolution ?? null,
      answered_by: answeredBy,
      answered_at: normaliseDate(answeredAt, answeredAt),
    } satisfies { selected: string | null; answered_by: string; answered_at: string };
    candidate.answer = answer;
  }

  // Synthesize a result_action for answered/deferred cards so downstream
  // consumers don't crash on missing structure.
  const status = coerceStatus(fm.status);
  if (status === "answered" && !candidate.result_action) {
    const action: GacResultAction = { type: "create_canon" };
    candidate.result_action = action;
  }
  if (status === "deferred" && !candidate.result_action) {
    const action: GacResultAction = { type: "defer_to_blocker" };
    candidate.result_action = action;
  }

  const parsed = gacCardSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return { card: parsed.data, rawFrontmatter: fm };
}

// -- directory scanning + watching ----------------------------------------

/** Canonical on-disk source locations for GAC cards. */
export function defaultGacSources(repoRoot: string): string[] {
  return [
    join(repoRoot, "ema-genesis", "intents"),
    join(repoRoot, ".superman", "gac"),
  ];
}

function isGacCardFile(path: string): boolean {
  return (
    path.endsWith(`${"/"}README.md`) ||
    path.endsWith(`${"/"}card.md`)
  );
}

function findGacFilesIn(rootDir: string): string[] {
  if (!existsSync(rootDir)) return [];
  const out: string[] = [];
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!/^GAC-/u.test(entry.name) && !/^\d+$/u.test(entry.name)) continue;
    const readme = join(rootDir, entry.name, "README.md");
    const card = join(rootDir, entry.name, "card.md");
    if (existsSync(readme)) out.push(readme);
    if (existsSync(card)) out.push(card);
  }
  return out;
}

export interface LoadReport {
  loaded: number;
  skipped: number;
  errors: Array<{ path: string; error: string }>;
}

export function loadAllGacCards(sources: string[]): LoadReport {
  const report: LoadReport = { loaded: 0, skipped: 0, errors: [] };
  for (const source of sources) {
    for (const path of findGacFilesIn(source)) {
      try {
        const content = readFileSync(path, "utf8");
        const parsed = parseGacCardFile(content);
        if (!parsed) {
          report.skipped += 1;
          continue;
        }
        upsertGacCardFromSource(parsed.card, resolve(path));
        report.loaded += 1;
      } catch (err) {
        report.errors.push({
          path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  filesystemEvents.emit("loaded", report);
  return report;
}

export interface WatcherHandle {
  close: () => void;
}

/**
 * Start a minimal filesystem watcher over the GAC source directories.
 *
 * This is the `services`-workspace-safe alternative to `chokidar` (not a
 * dependency of services per the brief). It debounces rapid successive
 * writes and re-parses any card.md / README.md file that changes.
 */
export function startGacWatcher(sources: string[]): WatcherHandle {
  const watchers: FSWatcher[] = [];
  const pending = new Map<string, NodeJS.Timeout>();

  const schedule = (path: string): void => {
    const existing = pending.get(path);
    if (existing) clearTimeout(existing);
    pending.set(
      path,
      setTimeout(() => {
        pending.delete(path);
        try {
          if (!existsSync(path)) {
            softDeleteBySourcePath(resolve(path));
            filesystemEvents.emit("deleted", path);
            return;
          }
          const content = readFileSync(path, "utf8");
          const parsed = parseGacCardFile(content);
          if (!parsed) {
            filesystemEvents.emit("skipped", path);
            return;
          }
          upsertGacCardFromSource(parsed.card, resolve(path));
          filesystemEvents.emit("upserted", parsed.card);
        } catch (err) {
          filesystemEvents.emit("error", { path, error: err });
        }
      }, 75),
    );
  };

  for (const source of sources) {
    if (!existsSync(source)) continue;
    if (!statSync(source).isDirectory()) continue;
    try {
      const watcher = watch(
        source,
        { recursive: true },
        (_event, filename) => {
          if (!filename) return;
          const abs = resolve(source, filename);
          if (!isGacCardFile(abs)) return;
          schedule(abs);
        },
      );
      watchers.push(watcher);
    } catch (err) {
      filesystemEvents.emit("error", { path: source, error: err });
    }
  }

  return {
    close: () => {
      for (const w of watchers) w.close();
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
    },
  };
}
