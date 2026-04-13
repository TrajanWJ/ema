#!/usr/bin/env node
// tools/quality-metrics/scan.mjs
//
// Walk ema-genesis/** and the wiki, report which files are missing the
// quality metrics frontmatter block defined in _meta/QUALITY-METRICS-SCHEMA.md.
//
// Does NOT write to any file. Pure inventory / reporting.
//
// Usage:
//   node tools/quality-metrics/scan.mjs                     # scan genesis only
//   node tools/quality-metrics/scan.mjs --wiki              # also scan wiki
//   node tools/quality-metrics/scan.mjs --json              # machine-readable output
//   node tools/quality-metrics/scan.mjs --unmarked-only     # only list missing
//
// Exit codes:
//   0 = scan complete
//   1 = filesystem error (missing genesis root, unreadable file)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_QUALITY_FIELDS = [
  'confidence',
  'freshness',
  'provenance',
  'coverage',
  'implementation_status',
  'contradicted_by',
  'last_verified_at',
  'quality_assessed_at',
  'quality_assessed_by',
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '_clones',
  '_extractions',
  'IGNORE_OLD_TAURI_BUILD',
  'dist',
  'build',
]);

function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (statSync(join(dir, 'ema-genesis'), { throwIfNoEntry: false })?.isDirectory()) {
      return dir;
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find repository root (no ema-genesis/ ancestor)');
}

function walkMarkdown(rootDir, results = []) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkMarkdown(join(rootDir, entry.name), results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(join(rootDir, entry.name));
    }
  }
  return results;
}

function extractFrontmatter(content) {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return null;
  return content.slice(4, end);
}

function getMissingFields(frontmatterText) {
  if (!frontmatterText) return REQUIRED_QUALITY_FIELDS;
  const missing = [];
  for (const field of REQUIRED_QUALITY_FIELDS) {
    // Match field at the start of a line, with optional whitespace,
    // followed by a colon. Covers flat keys at any indent level.
    const regex = new RegExp(`^\\s*${field}:`, 'm');
    if (!regex.test(frontmatterText)) {
      missing.push(field);
    }
  }
  return missing;
}

function classify(filePath, repoRoot) {
  const rel = relative(repoRoot, filePath);
  if (rel.startsWith('ema-genesis/canon/specs/')) return 'canon-spec';
  if (rel.startsWith('ema-genesis/canon/decisions/')) return 'canon-decision';
  if (rel.startsWith('ema-genesis/intents/')) return 'intent';
  if (rel.startsWith('ema-genesis/_meta/')) return 'meta';
  if (rel.startsWith('ema-genesis/research/')) return 'research';
  if (rel.startsWith('ema-genesis/executions/')) return 'execution';
  if (rel.startsWith('ema-genesis/vapps/')) return 'vapp-catalog';
  if (rel.startsWith('ema-genesis/')) return 'genesis-top';
  if (rel.includes('vault/wiki/')) return 'wiki';
  return 'other';
}

function main() {
  const args = new Set(process.argv.slice(2));
  const outputJson = args.has('--json');
  const unmarkedOnly = args.has('--unmarked-only');
  const includeWiki = args.has('--wiki');

  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = findRepoRoot(join(thisFile, '..', '..', '..'));

  const genesisRoot = join(repoRoot, 'ema-genesis');
  const files = walkMarkdown(genesisRoot);

  if (includeWiki) {
    const wikiRoot = join(process.env.HOME || '', '.local/share/ema/vault/wiki');
    try {
      statSync(wikiRoot);
      walkMarkdown(wikiRoot, files);
    } catch {
      // Wiki not present — skip silently.
    }
  }

  const results = [];
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatter = extractFrontmatter(content);
    const missing = getMissingFields(frontmatter);
    const kind = classify(filePath, repoRoot);
    results.push({
      path: relative(repoRoot, filePath),
      kind,
      hasFrontmatter: frontmatter !== null,
      missingFields: missing,
      isFullyUnmarked: missing.length === REQUIRED_QUALITY_FIELDS.length,
      isFullyMarked: missing.length === 0,
    });
  }

  const filtered = unmarkedOnly
    ? results.filter((r) => !r.isFullyMarked)
    : results;

  if (outputJson) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  // Human-readable output
  const byKind = new Map();
  for (const r of results) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, { total: 0, marked: 0, partial: 0, unmarked: 0 });
    const bucket = byKind.get(r.kind);
    bucket.total += 1;
    if (r.isFullyMarked) bucket.marked += 1;
    else if (r.isFullyUnmarked) bucket.unmarked += 1;
    else bucket.partial += 1;
  }

  console.log('Quality Metrics Scan');
  console.log('====================');
  console.log();
  console.log(`Scanned: ${results.length} files`);
  console.log();
  console.log('By kind:');
  const kindOrder = ['canon-spec', 'canon-decision', 'intent', 'meta', 'research', 'execution', 'vapp-catalog', 'genesis-top', 'wiki', 'other'];
  for (const kind of kindOrder) {
    if (!byKind.has(kind)) continue;
    const { total, marked, partial, unmarked } = byKind.get(kind);
    console.log(`  ${kind.padEnd(16)}  total ${String(total).padStart(4)}  marked ${String(marked).padStart(4)}  partial ${String(partial).padStart(4)}  unmarked ${String(unmarked).padStart(4)}`);
  }

  if (unmarkedOnly && filtered.length > 0) {
    console.log();
    console.log(`Files missing quality block (${filtered.length}):`);
    for (const r of filtered) {
      const marker = r.isFullyUnmarked ? '✗' : '◐';
      console.log(`  ${marker} ${r.path}`);
      if (!r.isFullyUnmarked && r.missingFields.length > 0) {
        console.log(`      missing: ${r.missingFields.join(', ')}`);
      }
    }
  }

  console.log();
  console.log('Fields absent → file is "unmarked" per the schema. Lazy population means');
  console.log('this is expected for most files today. Fields populate on file access.');
  console.log('See ema-genesis/_meta/QUALITY-METRICS-SCHEMA.md for the schema.');
}

try {
  main();
  process.exit(0);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
