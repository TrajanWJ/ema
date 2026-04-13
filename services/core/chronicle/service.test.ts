import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  __resetChronicleForTests,
  getChronicleRoot,
  getChronicleSessionDetail,
  importChronicleSession,
  listChronicleSessions,
} = await import("./service.js");
const { buildChronicleImportFromFile } = await import("../ingestion/service.js");

let chronicleDir = "";

function resetTables(): void {
  memoryDb.exec(`
    DROP TABLE IF EXISTS chronicle_artifacts;
    DROP TABLE IF EXISTS chronicle_entries;
    DROP TABLE IF EXISTS chronicle_sessions;
    DROP TABLE IF EXISTS chronicle_sources;
  `);
  __resetChronicleForTests();
}

beforeEach(() => {
  resetTables();
  chronicleDir = mkdtempSync(join(tmpdir(), "ema-chronicle-"));
  process.env.EMA_CHRONICLE_DIR = chronicleDir;
});

afterEach(() => {
  delete process.env.EMA_CHRONICLE_DIR;
  if (chronicleDir) {
    rmSync(chronicleDir, { recursive: true, force: true });
  }
});

describe("Chronicle service", () => {
  it("imports a generic bundle and lists it", () => {
    const detail = importChronicleSession({
      source: {
        kind: "manual",
        label: "Test bundle",
      },
      session: {
        title: "Imported planning session",
        summary: "Captured from a local export",
        project_hint: "ema",
        entries: [
          {
            role: "user",
            kind: "message",
            content: "Build Chronicle first.",
            metadata: {},
          },
          {
            role: "assistant",
            kind: "message",
            content: "Chronicle needs raw storage and browse routes.",
            metadata: {},
          },
        ],
        artifacts: [
          {
            name: "summary.md",
            kind: "attachment",
            text_content: "# Chronicle\n",
            metadata: {},
          },
        ],
        metadata: {},
        raw_payload: {
          kind: "fixture",
        },
      },
    });

    expect(getChronicleRoot()).toBe(chronicleDir);
    expect(detail.session.status).toBe("normalized");
    expect(detail.entries).toHaveLength(2);
    expect(detail.artifacts).toHaveLength(1);

    const sessions = listChronicleSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.source_kind).toBe("manual");

    const fetched = getChronicleSessionDetail(detail.session.id);
    expect(fetched.session.raw_path).toContain("/sessions/");
    expect(fetched.artifacts[0]?.stored_path).toContain("/artifacts/");
  });

  it("builds a Chronicle import from a local transcript file", () => {
    const transcriptPath = join(chronicleDir, "sample.jsonl");
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({ role: "user", content: "Audit the CLI" }),
        JSON.stringify({ role: "assistant", content: "I found two missing commands." }),
      ].join("\n"),
      "utf8",
    );

    const bundle = buildChronicleImportFromFile({
      path: transcriptPath,
      source_kind: "manual",
      source_label: "Fixture transcript",
    });
    const detail = importChronicleSession(bundle);

    expect(detail.session.title).toBe("Audit the CLI");
    expect(detail.entries).toHaveLength(2);
    expect(detail.source.label).toBe("Fixture transcript");
  });
});
