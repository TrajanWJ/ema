// ema health check
//
// Smoke test: finds the genesis root, counts canon nodes, intents, executions,
// and research nodes. Prints a short summary. Exits non-zero if the genesis
// root can't be found.
//
// This is the first observability command. Agents use it to confirm the CLI
// can reach canonical state before running any deeper query.

import { Command, Flags } from '@oclif/core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  findGenesisRoot,
  canonSpecsRoot,
  canonDecisionsRoot,
  intentsRoot,
  executionsRoot,
  researchRoot,
  metaRoot,
} from '../../lib/genesis-root.js';
import { printJson } from '../../lib/table-printer.js';

interface Counts {
  readonly canonSpecs: number;
  readonly canonDecisions: number;
  readonly intents: number;
  readonly executions: number;
  readonly researchNodes: number;
  readonly metaFiles: number;
}

export default class HealthCheck extends Command {
  public static override readonly description =
    'Smoke test: locate the genesis graph and report node counts per layer.';

  public static override readonly examples = [
    '<%= config.bin %> health check',
    '<%= config.bin %> health check --json',
  ];

  public static override readonly flags = {
    json: Flags.boolean({
      description: 'Emit JSON instead of a human-readable summary.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(HealthCheck);

    let genesisRoot: string;
    try {
      genesisRoot = findGenesisRoot();
    } catch (err) {
      if (flags.json) {
        printJson({ ok: false, error: (err as Error).message });
      } else {
        this.log('✗ Genesis graph not found.');
        this.log(`  ${(err as Error).message}`);
      }
      this.exit(1);
    }

    const counts = countAll();
    const total =
      counts.canonSpecs +
      counts.canonDecisions +
      counts.intents +
      counts.executions +
      counts.researchNodes +
      counts.metaFiles;

    if (flags.json) {
      printJson({
        ok: true,
        genesis_root: genesisRoot,
        counts,
        total_markdown_nodes: total,
      });
      return;
    }

    this.log('✓ EMA CLI health check');
    this.log('');
    this.log(`Genesis root: ${genesisRoot}`);
    this.log('');
    this.log('Node counts:');
    this.log(`  canon/specs/      ${String(counts.canonSpecs).padStart(4)}`);
    this.log(`  canon/decisions/  ${String(counts.canonDecisions).padStart(4)}`);
    this.log(`  intents/          ${String(counts.intents).padStart(4)}`);
    this.log(`  executions/       ${String(counts.executions).padStart(4)}`);
    this.log(`  research/         ${String(counts.researchNodes).padStart(4)}`);
    this.log(`  _meta/            ${String(counts.metaFiles).padStart(4)}`);
    this.log(`  ────────────────────`);
    this.log(`  total             ${String(total).padStart(4)}`);
    this.log('');
    this.log('CLI is alive. Try: ema intent list');
  }
}

function countAll(): Counts {
  return {
    canonSpecs: countMarkdownRecursive(canonSpecsRoot()),
    canonDecisions: countMarkdown(canonDecisionsRoot()),
    intents: countIntentsRoot(intentsRoot()),
    executions: countIntentsRoot(executionsRoot()),
    researchNodes: countMarkdownRecursive(researchRoot()),
    metaFiles: countMarkdown(metaRoot()),
  };
}

/** Count .md files directly in a directory (non-recursive). */
function countMarkdown(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) n += 1;
  }
  return n;
}

/**
 * Count .md files recursively under a directory.
 * Skips dotfiles and underscore-prefixed subdirs (_moc, _clones, _extractions).
 * This matches the research-layer convention used by lib/node-loader.ts.
 */
function countMarkdownRecursive(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = String(entry.name);
    if (name.startsWith('.') || name.startsWith('_')) continue;
    if (entry.isDirectory()) {
      n += countMarkdownRecursive(join(dir, name));
    } else if (entry.isFile() && name.endsWith('.md')) {
      n += 1;
    }
  }
  return n;
}

/**
 * Count intent-style entries: folders with README.md plus loose .md files.
 * Mirrors the loader convention for intents/ and executions/.
 */
function countIntentsRoot(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (existsSync(join(dir, entry.name, 'README.md'))) n += 1;
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      n += 1;
    }
  }
  return n;
}
