import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VaultSeeder, type VaultSeed } from "./vault-seeder.js";

describe("VaultSeeder", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vault-seeder-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function write(rel: string, body: string): Promise<void> {
    const full = join(root, rel);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, body, "utf8");
  }

  it("extracts TODO, unchecked checkbox, and IDEA lines", async () => {
    await write(
      "notes/one.md",
      [
        "# Notes",
        "TODO: wire up the bus",
        "- [ ] draft the GAC card",
        "IDEA: collapse the adapters",
        "plain paragraph, no match",
      ].join("\n"),
    );

    const seeder = new VaultSeeder({ vaultRoot: root });
    const seeds = await seeder.scan();

    const kinds = seeds.map((s) => s.kind).sort();
    expect(kinds).toEqual(["marked_idea", "todo", "unchecked_checkbox"]);
    const texts = seeds.map((s) => s.text).sort();
    expect(texts).toEqual([
      "collapse the adapters",
      "draft the GAC card",
      "wire up the bus",
    ]);
    for (const seed of seeds) {
      expect(seed.id).toBeTruthy();
      expect(seed.line).toBeGreaterThan(0);
      expect(seed.source_file).toContain("one.md");
    }
  });

  it("harvests inline #tags into the tags array", async () => {
    await write("ideas.md", "TODO: build prefetch #infra #perf-win");

    const seeder = new VaultSeeder({ vaultRoot: root });
    const [seed] = await seeder.scan();

    expect(seed).toBeDefined();
    expect(seed?.tags.sort()).toEqual(["infra", "perf-win"]);
  });

  it("ignores files under node_modules, dist, .git, Archive", async () => {
    await write("node_modules/pkg/readme.md", "TODO: should be ignored");
    await write("dist/build.md", "TODO: should be ignored");
    await write(".git/HEAD.md", "TODO: should be ignored");
    await write("Archive/old.md", "TODO: should be ignored");
    await write("real.md", "TODO: keep me");

    const seeder = new VaultSeeder({ vaultRoot: root });
    const seeds = await seeder.scan();

    expect(seeds).toHaveLength(1);
    expect(seeds[0]?.text).toBe("keep me");
  });

  it("emits via the constructor callback", async () => {
    await write("a.md", "IDEA: first\nTODO: second");
    const captured: VaultSeed[] = [];
    const seeder = new VaultSeeder({
      vaultRoot: root,
      emit: (seed) => captured.push(seed),
    });

    const scanned = await seeder.scan();
    expect(captured).toHaveLength(scanned.length);
    expect(captured.length).toBe(2);
  });

  it("respects the limit option", async () => {
    await write(
      "big.md",
      Array.from({ length: 10 }, (_, i) => `TODO: item ${i}`).join("\n"),
    );

    const seeder = new VaultSeeder({ vaultRoot: root });
    const seeds = await seeder.scan({ limit: 3 });
    expect(seeds).toHaveLength(3);
  });

  it("returns an empty array for a non-existent vault root", async () => {
    const seeder = new VaultSeeder({ vaultRoot: join(root, "does-not-exist") });
    const seeds = await seeder.scan();
    expect(seeds).toEqual([]);
  });

  it("watch() returns a stop function", async () => {
    const seeder = new VaultSeeder({ vaultRoot: root });
    const stop = await seeder.watch();
    expect(typeof stop).toBe("function");
    stop();
  });
});
