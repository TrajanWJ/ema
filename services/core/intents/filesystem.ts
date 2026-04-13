/**
 * Filesystem sync for the Intents subservice.
 *
 * Two mirror locations per Self-Pollination Appendix A.6:
 *
 *   1. .superman/intents/<kebab-slug>/intent.md + status.json — runtime
 *   2. ema-genesis/intents/INT-<SLUG>/README.md                — canonical
 *
 * GAC-<NNN> subdirectories under ema-genesis/intents/ are deliberately skipped
 * — those belong to the Blueprint subservice.
 *
 * Parsing strategy:
 *
 * - YAML frontmatter is hand-parsed (the brief forbids installing
 *   `gray-matter`). The parser handles the shapes actually used by the
 *   hand-authored intents: flat scalar, inline list, block list of strings,
 *   block list of `{ type|target, relation }` inline-object entries.
 * - Tags pulled from either a frontmatter `tags: [...]` or trailing
 *   `#tag #tag` lines in the body.
 * - Fields missing from the frontmatter are back-filled with sensible
 *   defaults so legacy intents still validate against `intentSchema`.
 *
 * Watching uses `node:fs.watch` recursively with a debounce. `chokidar` is
 * not a dep of the services workspace and the brief forbids adding one.
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
  intentSchema,
  type EmaLink,
  type Intent,
} from "@ema/shared/schemas";
import {
  softDeleteBySourcePath,
  upsertIntentFromSource,
} from "./service.js";
import type { IntentPhase } from "./state-machine.js";

export const intentsFilesystemEvents = new EventEmitter();

// -- YAML frontmatter parser ---------------------------------------------

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
  const inner = raw.trim().replace(/^\{/u, "").replace(/\}$/u, "");
  const out: Record<string, YamlValue> = {};
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
 * Minimal block-YAML parser. Handles the subset used by intent frontmatter:
 *
 *   key: scalar
 *   key: [a, b, c]
 *   key:
 *     - scalar
 *     - { target: "...", relation: "..." }
 *     - "  quoted.path/**"
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

// -- coercion helpers -----------------------------------------------------

function coerceString(value: YamlValue | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function coerceStringOrUndefined(
  value: YamlValue | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function coerceStringList(value: YamlValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") out.push(item);
  }
  return out;
}

function normaliseDate(
  value: YamlValue | undefined,
  fallback: string,
): string {
  if (typeof value === "string") {
    if (/T\d{2}:\d{2}/u.test(value)) {
      // Already ISO-ish. Append Z if naked.
      return /Z$|[+-]\d{2}:?\d{2}$/u.test(value) ? value : `${value}Z`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return `${value}T00:00:00Z`;
  }
  return fallback;
}

const VALID_LEVELS = [
  "vision",
  "strategy",
  "objective",
  "initiative",
  "execution",
  "task",
] as const;

function coerceLevel(value: YamlValue | undefined): Intent["level"] {
  if (typeof value === "string") {
    const found = VALID_LEVELS.find((l) => l === value);
    if (found) return found;
  }
  return "initiative";
}

const VALID_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "abandoned",
] as const;

function coerceStatus(value: YamlValue | undefined): Intent["status"] {
  if (typeof value === "string") {
    const found = VALID_STATUSES.find((s) => s === value);
    if (found) return found;
    // Map a few legacy aliases from the old Elixir build.
    if (value === "implementing" || value === "in_progress") return "active";
    if (value === "complete") return "completed";
    if (value === "planned" || value === "outlined" || value === "researched")
      return "draft";
    if (value === "blocked") return "paused";
    if (value === "archived") return "abandoned";
  }
  return "draft";
}

const VALID_KINDS = [
  "implement",
  "port",
  "research",
  "explore",
  "planning",
  "brain_dump",
] as const;

function coerceKind(
  value: YamlValue | undefined,
): Intent["kind"] | undefined {
  if (typeof value === "string") {
    const found = VALID_KINDS.find((k) => k === value);
    if (found) return found;
  }
  return undefined;
}

const VALID_PHASES = ["idle", "plan", "execute", "review", "retro"] as const;

function coercePhase(value: YamlValue | undefined): IntentPhase {
  if (typeof value === "string") {
    const found = VALID_PHASES.find((p) => p === value);
    if (found) return found;
  }
  return "idle";
}

const EDGE_TYPE_MAP: Record<string, EmaLink["type"]> = {
  fulfills: "fulfills",
  blocks: "blocks",
  derived_from: "derived_from",
  references: "references",
  supersedes: "supersedes",
  aspiration_of: "aspiration_of",
  // Common legacy aliases seen in hand-authored intents.
  fulfilled_by: "fulfills",
  derives_from: "derived_from",
  related: "references",
  related_to: "references",
};

function coerceEmaLinks(value: YamlValue | undefined): EmaLink[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: EmaLink[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }
    const rawTypeValue = item.type ?? item.relation;
    const target = item.target;
    if (typeof target !== "string" || typeof rawTypeValue !== "string") {
      continue;
    }
    const mapped = EDGE_TYPE_MAP[rawTypeValue];
    if (!mapped) continue;
    out.push({ type: mapped, target });
  }
  return out.length > 0 ? out : undefined;
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

function coerceTags(
  fmTags: YamlValue | undefined,
  body: string,
): string[] {
  const fromFrontmatter = coerceStringList(fmTags);
  if (fromFrontmatter.length > 0) return fromFrontmatter;
  return extractTagsFromBody(body);
}

function extractFirstParagraph(body: string): string | null {
  const paragraphs = body.split(/\n\s*\n/u);
  for (const rawPara of paragraphs) {
    const para = rawPara.trim();
    if (para.length === 0) continue;
    if (para.startsWith("#")) continue; // heading
    if (para.startsWith(">")) {
      // blockquote — strip leading `> ` markers
      return para.replace(/^>\s?/gmu, "").trim();
    }
    return para;
  }
  return null;
}

// -- slug / id helpers ----------------------------------------------------

function kebabFromId(rawId: string): string {
  return rawId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

// -- public parse API -----------------------------------------------------

export interface ParsedIntent {
  intent: Intent;
  phase: IntentPhase;
  tags: string[];
  rawFrontmatter: Record<string, YamlValue>;
}

export function parseIntentFile(content: string): ParsedIntent | null {
  const split = splitFrontmatter(content);
  if (!split) return null;
  const fm = parseYaml(split.frontmatter);

  const rawId = coerceString(fm.id, "");
  if (rawId.length === 0) return null;
  // Skip GAC-* files — those belong to blueprint.
  if (/^GAC-/u.test(rawId)) return null;

  const id = kebabFromId(rawId);
  if (id.length === 0) return null;

  const created = normaliseDate(fm.created, "2026-01-01T00:00:00Z");
  const updated = normaliseDate(fm.updated, created);

  const description =
    coerceStringOrUndefined(fm.description) ?? extractFirstParagraph(split.body);

  const emaLinksFromYaml = coerceEmaLinks(fm.ema_links);
  const emaLinksFromConnections = coerceEmaLinks(fm.connections);
  const emaLinks = emaLinksFromYaml ?? emaLinksFromConnections;

  const tags = coerceTags(fm.tags, split.body);

  const candidate: Record<string, unknown> = {
    id,
    inserted_at: created,
    updated_at: updated,
    title: coerceString(fm.title, rawId),
    description: description ?? null,
    level: coerceLevel(fm.level),
    status: coerceStatus(fm.status),
    parent_id: coerceStringOrUndefined(fm.parent_id) ?? null,
    project_id: coerceStringOrUndefined(fm.project_id) ?? null,
    actor_id: coerceStringOrUndefined(fm.actor_id) ?? null,
    metadata: {
      source_id: rawId,
      ...(typeof fm.priority === "string" ? { priority: fm.priority } : {}),
      ...(typeof fm.author === "string" ? { author: fm.author } : {}),
    },
  };

  const kind = coerceKind(fm.kind);
  if (kind) candidate.kind = kind;

  const exitCondition = coerceStringOrUndefined(fm.exit_condition);
  if (exitCondition !== undefined) candidate.exit_condition = exitCondition;

  const scope = coerceStringList(fm.scope);
  if (scope.length > 0) candidate.scope = scope;

  const spaceId = coerceStringOrUndefined(fm.space_id);
  if (spaceId !== undefined) candidate.space_id = spaceId;

  if (emaLinks && emaLinks.length > 0) candidate.ema_links = emaLinks;

  const parsed = intentSchema.safeParse(candidate);
  if (!parsed.success) return null;

  return {
    intent: parsed.data,
    phase: coercePhase(fm.phase),
    tags,
    rawFrontmatter: fm,
  };
}

// -- directory scanning ---------------------------------------------------

/** Canonical on-disk source locations for intents. */
export function defaultIntentSources(repoRoot: string): string[] {
  return [
    join(repoRoot, "ema-genesis", "intents"),
    join(repoRoot, ".superman", "intents"),
  ];
}

function isIntentFile(path: string): boolean {
  return (
    path.endsWith(`${"/"}README.md`) ||
    path.endsWith(`${"/"}intent.md`)
  );
}

function findIntentFilesIn(rootDir: string): string[] {
  if (!existsSync(rootDir)) return [];
  const out: string[] = [];
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Skip GAC-* — those belong to blueprint.
    if (/^GAC-/u.test(entry.name)) continue;
    const readme = join(rootDir, entry.name, "README.md");
    const intentMd = join(rootDir, entry.name, "intent.md");
    if (existsSync(readme)) out.push(readme);
    if (existsSync(intentMd)) out.push(intentMd);
  }
  return out;
}

export interface LoadReport {
  loaded: number;
  skipped: number;
  errors: Array<{ path: string; error: string }>;
}

export function loadAllIntents(sources: string[]): LoadReport {
  const report: LoadReport = { loaded: 0, skipped: 0, errors: [] };
  for (const source of sources) {
    for (const path of findIntentFilesIn(source)) {
      try {
        const content = readFileSync(path, "utf8");
        const parsed = parseIntentFile(content);
        if (!parsed) {
          report.skipped += 1;
          continue;
        }
        upsertIntentFromSource({
          intent: parsed.intent,
          phase: parsed.phase,
          tags: parsed.tags,
          sourcePath: resolve(path),
        });
        report.loaded += 1;
      } catch (err) {
        report.errors.push({
          path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  intentsFilesystemEvents.emit("loaded", report);
  return report;
}

export interface WatcherHandle {
  close: () => void;
}

/**
 * Start a minimal filesystem watcher over the intent source directories.
 * Debounced to swallow Linux's duplicate fire-per-save.
 */
export function startIntentWatcher(sources: string[]): WatcherHandle {
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
            intentsFilesystemEvents.emit("deleted", path);
            return;
          }
          const content = readFileSync(path, "utf8");
          const parsed = parseIntentFile(content);
          if (!parsed) {
            intentsFilesystemEvents.emit("skipped", path);
            return;
          }
          upsertIntentFromSource({
            intent: parsed.intent,
            phase: parsed.phase,
            tags: parsed.tags,
            sourcePath: resolve(path),
          });
          intentsFilesystemEvents.emit("upserted", parsed.intent);
        } catch (err) {
          intentsFilesystemEvents.emit("error", { path, error: err });
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
          if (!isIntentFile(abs)) return;
          schedule(abs);
        },
      );
      watchers.push(watcher);
    } catch (err) {
      intentsFilesystemEvents.emit("error", { path: source, error: err });
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
