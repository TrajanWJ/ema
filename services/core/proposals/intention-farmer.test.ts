import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  IntentionFarmer,
  type HarvestedIntent,
} from "./intention-farmer.js";

describe("IntentionFarmer", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "intention-farmer-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function writeVaultFile(rel: string, body: string): Promise<void> {
    const full = join(root, rel);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, body, "utf8");
  }

  it("addSource + listSources round-trip", () => {
    const farmer = new IntentionFarmer();
    expect(farmer.listSources()).toHaveLength(0);
    farmer.addSource({
      id: "git:main",
      kind: "git-commit",
      config: { repo: "/tmp/x" },
    });
    farmer.addSource({
      id: "chan:inbox",
      kind: "channel",
      config: { channel: "inbox" },
    });
    const sources = farmer.listSources();
    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.id).sort()).toEqual(["chan:inbox", "git:main"]);
  });

  it("harvests vault TODOs and IDEAs as HarvestedIntents", async () => {
    await writeVaultFile(
      "notes.md",
      "TODO: port the seeder\nIDEA: collapse adapters\n- [ ] unchecked",
    );

    const farmer = new IntentionFarmer({ vaultRoot: root });
    const intents = await farmer.harvest();

    // unchecked checkbox is filtered out — harvested intents are only
    // explicit TODOs and IDEAs.
    expect(intents).toHaveLength(2);
    const kinds = intents.map((i) => i.suggested_kind).sort();
    expect(kinds).toEqual(["idea", "task"]);
    for (const intent of intents) {
      expect(intent.source).toBe("vault");
      expect(intent.source_ref).toContain("notes.md");
      expect(intent.id).toBeTruthy();
    }
  });

  it("clean({dryRun: true}) reports 0 without touching the fs", async () => {
    const farmer = new IntentionFarmer({ vaultRoot: root });
    const result = await farmer.clean(true);
    expect(result).toEqual({ removed: 0 });
  });

  it("backlog() returns loaded intents and calls the persist hook", async () => {
    await writeVaultFile("a.md", "TODO: one\nTODO: two\nIDEA: three");
    const persisted: HarvestedIntent[] = [];

    const farmer = new IntentionFarmer({
      vaultRoot: root,
      persist: (intent) => {
        persisted.push(intent);
      },
    });

    const intents = await farmer.backlog();
    expect(intents).toHaveLength(3);
    expect(persisted).toHaveLength(3);
  });

  it("load() parses a previously-harvested JSON snapshot", async () => {
    const snapshot = join(root, "harvested.json");
    const sample: HarvestedIntent[] = [
      {
        id: "abc",
        title: "stub intent",
        body: "",
        source: "vault",
        source_ref: "notes.md:1",
        harvested_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    await writeFile(snapshot, JSON.stringify(sample), "utf8");

    const farmer = new IntentionFarmer({ harvestPath: snapshot });
    const loaded = await farmer.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe("abc");
  });

  it("injected collectors override the native switch", async () => {
    const stub: HarvestedIntent = {
      id: "x",
      title: "from stub",
      body: "",
      source: "git-commit",
      source_ref: "deadbeef",
      harvested_at: new Date().toISOString(),
    };

    const farmer = new IntentionFarmer({
      sources: [
        { id: "git:stub", kind: "git-commit", config: {} },
      ],
      collectors: {
        "git-commit": () => [stub],
      },
    });

    const intents = await farmer.harvest();
    expect(intents).toHaveLength(1);
    expect(intents[0]?.title).toBe("from stub");
    expect(intents[0]?.source).toBe("git-commit");
  });

  it("dedupes identical intents within a single harvest", async () => {
    const stub: HarvestedIntent = {
      id: "dup1",
      title: "same title",
      body: "same body",
      source: "channel",
      source_ref: "chan:1",
      harvested_at: new Date().toISOString(),
    };
    const twin: HarvestedIntent = { ...stub, id: "dup2" };

    const farmer = new IntentionFarmer({
      sources: [{ id: "c", kind: "channel", config: {} }],
      collectors: { channel: () => [stub, twin] },
    });

    const intents = await farmer.harvest();
    expect(intents).toHaveLength(1);
  });

  it("bootstrap() completes without throwing on an empty vault", async () => {
    const farmer = new IntentionFarmer({ vaultRoot: root });
    await expect(farmer.bootstrap()).resolves.toBeUndefined();
  });
});
