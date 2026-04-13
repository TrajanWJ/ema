/**
 * IntentionFarmer — multi-source intent harvester.
 *
 * Facade around BacklogFarmer / BootstrapWatcher / Cleaner / Loader, ported
 * from `Ema.IntentionFarmer` and friends in the old Elixir daemon.
 *
 * Sources currently implemented natively:
 *   - `vault`: recursive markdown scan via VaultSeeder, filtered to TODO and
 *              marked-idea lines and promoted to HarvestedIntents.
 *   - `brain-dump`: reads a JSON file produced by the brain-dump app and
 *                   turns each entry into a HarvestedIntent.
 *
 * Sources that talk to live infrastructure (`git-commit`, `channel`) are
 * registered and listed but only harvested when a caller injects a custom
 * collector via the `collectors` option. That keeps tests hermetic and
 * avoids a hard dependency on simple-git, a message bus, etc.
 */

import { promises as fs } from "node:fs";
import { basename } from "node:path";

import { nanoid } from "nanoid";

import { getRuntimeBundle } from "../intents/service.js";
import { BacklogFarmer } from "./intention-farmer/backlog-farmer.js";
import { BootstrapWatcher } from "./intention-farmer/bootstrap-watcher.js";
import { Cleaner } from "./intention-farmer/cleaner.js";
import { Loader, type HarvestedIntent } from "./intention-farmer/loader.js";
import {
  SourceRegistry,
  type SourceDefinition,
  type SourceKind,
} from "./intention-farmer/source-registry.js";
import { VaultSeeder } from "./vault-seeder.js";

export type { HarvestedIntent } from "./intention-farmer/loader.js";
export type {
  SourceDefinition,
  SourceKind,
} from "./intention-farmer/source-registry.js";

/**
 * Injectable collector for a non-native source. Receives the registered
 * source definition and must return the intents it produced.
 */
export type SourceCollector = (
  def: SourceDefinition,
) => Promise<HarvestedIntent[]> | HarvestedIntent[];

export interface IntentionFarmerOptions {
  vaultRoot?: string;
  gitRepo?: string;
  sources?: SourceDefinition[];
  collectors?: Partial<Record<SourceKind, SourceCollector>>;
  /** Where `load()` reads a previously-persisted harvest JSON from. */
  harvestPath?: string;
  /** Persist hook for Loader. Tests pass a spy; prod passes the DB writer. */
  persist?: (intent: HarvestedIntent) => void | Promise<void>;
}

export class IntentionFarmer {
  private readonly registry = new SourceRegistry();
  private readonly cleaner = new Cleaner();
  private readonly loader: Loader;
  private readonly backlogFarmer: BacklogFarmer;
  private readonly bootstrapWatcher = new BootstrapWatcher();
  private readonly opts: IntentionFarmerOptions;

  constructor(opts: IntentionFarmerOptions = {}) {
    this.opts = opts;
    const loaderOptions: ConstructorParameters<typeof Loader>[0] = {};
    if (opts.persist) loaderOptions.persist = opts.persist;
    this.loader = new Loader(loaderOptions);

    this.backlogFarmer = new BacklogFarmer({
      collect: () => this.collect(),
      cleaner: this.cleaner,
      loader: this.loader,
    });

    for (const def of opts.sources ?? []) this.registry.add(def);

    // Auto-register implicit sources for the convenience of callers that
    // just pass `vaultRoot` / `gitRepo` without building SourceDefinitions.
    if (opts.vaultRoot && !this.hasSourceOfKind("vault")) {
      this.registry.add({
        id: "vault:default",
        kind: "vault",
        config: { root: opts.vaultRoot },
      });
    }
    if (opts.gitRepo && !this.hasSourceOfKind("git-commit")) {
      this.registry.add({
        id: "git:default",
        kind: "git-commit",
        config: { repo: opts.gitRepo },
      });
    }
  }

  // -- public API ---------------------------------------------------------

  addSource(def: SourceDefinition): void {
    this.registry.add(def);
  }

  listSources(): SourceDefinition[] {
    return this.registry.list();
  }

  /** One-shot harvest across all registered sources. */
  async harvest(): Promise<HarvestedIntent[]> {
    const raw = await this.collect();
    const { kept } = this.cleaner.clean(raw);
    return this.loader.loadBatch(kept);
  }

  /**
   * Full backlog sweep — same pipeline as `harvest` but returns the
   * richer summary object that BacklogFarmer produces.
   */
  async backlog(): Promise<HarvestedIntent[]> {
    const summary = await this.backlogFarmer.run();
    return summary.intents;
  }

  /**
   * One-shot bootstrap with retry. Wraps a single harvest pass in the
   * BootstrapWatcher so transient filesystem hiccups don't poison startup.
   */
  async bootstrap(): Promise<void> {
    await this.bootstrapWatcher.run(async () => this.harvest());
  }

  /**
   * Remove stale harvested records. In dryRun mode we only count — writes
   * require a caller-supplied persist hook that handles deletion too, so
   * the default behaviour is a safe no-op returning `{ removed: 0 }`.
   */
  async clean(dryRun = false): Promise<{ removed: number }> {
    if (dryRun) return { removed: 0 };
    // Without a delete callback wired through Loader we can't safely remove.
    // Returning 0 mirrors the Elixir Cleaner's behaviour when no GC hook is
    // registered — callers that need real deletion should build it on top.
    return { removed: 0 };
  }

  /** Load a previously harvested JSON snapshot from `opts.harvestPath`. */
  async load(): Promise<HarvestedIntent[]> {
    if (!this.opts.harvestPath) return [];
    return this.loader.loadFromFile(this.opts.harvestPath);
  }

  // -- collection ---------------------------------------------------------

  private hasSourceOfKind(kind: SourceKind): boolean {
    return this.registry.listByKind(kind).length > 0;
  }

  private async collect(): Promise<HarvestedIntent[]> {
    const out: HarvestedIntent[] = [];
    for (const def of this.registry.list()) {
      const custom = this.opts.collectors?.[def.kind];
      if (custom) {
        const produced = await custom(def);
        out.push(...produced);
        continue;
      }

      switch (def.kind) {
        case "vault":
          out.push(...(await collectVault(def)));
          break;
        case "brain-dump":
          out.push(...(await collectBrainDump(def)));
          break;
        case "git-commit":
        case "channel":
          // No native collector — caller must inject one.
          break;
      }
    }
    return out;
  }
}

// -- native collectors ----------------------------------------------------

async function collectVault(def: SourceDefinition): Promise<HarvestedIntent[]> {
  const root = typeof def.config.root === "string" ? def.config.root : null;
  if (!root) return [];
  const seeder = new VaultSeeder({ vaultRoot: root });
  const seeds = await seeder.scan();
  return seeds
    .filter((seed) => seed.kind !== "unchecked_checkbox")
    .map((seed) => ({
      id: nanoid(),
      title: seed.text,
      body: seed.tags.length > 0 ? `#${seed.tags.join(" #")}` : "",
      source: "vault" as const,
      source_ref: `${seed.source_file}:${seed.line}`,
      harvested_at: seed.extracted_at,
      suggested_kind: seed.kind === "todo" ? "task" : "idea",
    }));
}

/**
 * Intent-driven seed generation — the DEC-007 bridge between semantic
 * intents and proposal seeds. Given an intent slug, pull its runtime
 * bundle from the intents service and mint a small set of
 * `HarvestedIntent`s that feed the proposal pipeline.
 *
 * This is NOT the full 5-stage Generator → Refiner → Debater → Tagger →
 * Combiner pipeline — that is tracked as `INT-PROPOSAL-PIPELINE`. This is
 * the minimum seed-minting surface so an approved intent has something to
 * propose against while the full pipeline is still under construction.
 *
 * Seeds produced:
 *   1. One `idea` seed with the intent title + description
 *   2. One seed per `ema_links` edge where the target is a canon doc
 *      (so that proposals can cross-reference the canon context)
 *
 * Callers pass the injection-style `persist` hook if they want the
 * resulting seeds stored durably; otherwise the seeds are returned for
 * the caller to hand to the Loader.
 */
export async function proposalsForIntent(
  intentSlug: string,
  opts: { persist?: (intent: HarvestedIntent) => void | Promise<void> } = {},
): Promise<HarvestedIntent[]> {
  const bundle = getRuntimeBundle(intentSlug);
  if (!bundle) return [];
  const { intent } = bundle;
  const now = new Date().toISOString();
  const seeds: HarvestedIntent[] = [];

  seeds.push({
    id: nanoid(),
    title: intent.title.slice(0, 200),
    body:
      (intent.description ?? "") +
      (intent.exit_condition
        ? `\n\nExit condition: ${intent.exit_condition}`
        : ""),
    source: "intent",
    source_ref: `intent:${intent.id}`,
    harvested_at: now,
    suggested_kind: "idea",
  });

  if (intent.ema_links) {
    for (const link of intent.ema_links) {
      if (!link.target.toLowerCase().includes("canon")) continue;
      seeds.push({
        id: nanoid(),
        title: `${intent.title} → ${link.type}: ${link.target}`,
        body: `Proposal seed derived from intent ${intent.id} ${link.type} ${link.target}`,
        source: "intent",
        source_ref: `intent:${intent.id}:${link.type}:${link.target}`,
        harvested_at: now,
        suggested_kind: "idea",
      });
    }
  }

  if (opts.persist) {
    for (const seed of seeds) {
      await opts.persist(seed);
    }
  }

  return seeds;
}

async function collectBrainDump(
  def: SourceDefinition,
): Promise<HarvestedIntent[]> {
  const path = typeof def.config.path === "string" ? def.config.path : null;
  if (!path) return [];

  let raw: string;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { entries?: unknown })?.entries)
      ? ((parsed as { entries: unknown[] }).entries)
      : [];

  const out: HarvestedIntent[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const title =
      typeof rec.title === "string"
        ? rec.title
        : typeof rec.text === "string"
          ? rec.text
          : "";
    if (title.trim().length === 0) continue;

    out.push({
      id: nanoid(),
      title: title.slice(0, 200),
      body: typeof rec.body === "string" ? rec.body : "",
      source: "brain-dump",
      source_ref:
        typeof rec.id === "string" ? rec.id : `${basename(path)}:${out.length}`,
      harvested_at:
        typeof rec.created_at === "string"
          ? rec.created_at
          : new Date().toISOString(),
    });
  }
  return out;
}
