/**
 * Spaces subservice tests.
 *
 * Uses a hermetic in-memory SQLite database via `vi.mock` of the persistence
 * layer so tests never touch the shared `~/.local/share/ema/ema.db` file.
 *
 * Covers:
 *   1. DDL bootstrap creates spaces + space_transitions tables
 *   2. initSpaces seeds the default `personal` space idempotently
 *   3. createSpace persists + emits a created event
 *   4. slugs are unique — duplicate creates throw SpaceSlugTakenError
 *   5. listSpaces hides archived by default, shows with include_archived
 *   6. getSpace resolves by id and by slug
 *   7. archiveSpace transitions active → archived, writes transition row
 *   8. state machine rejects archived → archived
 *   9. addMember/removeMember round-trip with event emission
 *  10. archived spaces reject member mutations
 */

import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hermetic DB stub ---------------------------------------------------
const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  addMember,
  archiveSpace,
  createSpace,
  getSpace,
  initSpaces,
  InvalidSpaceMutationError,
  listSpaces,
  listTransitions,
  removeMember,
  seedDefaultSpace,
  SpaceSlugTakenError,
  spacesEvents,
} = await import("./service.js");
const {
  canTransition,
  InvalidSpaceTransitionError,
} = await import("./state-machine.js");

function resetDb(): void {
  memoryDb.exec(`
    DELETE FROM space_transitions;
    DELETE FROM spaces;
  `);
}

beforeAll(() => {
  initSpaces();
});

beforeEach(() => {
  resetDb();
  // Re-seed the default space so each test starts from the same cold-boot
  // state (the `personal` space always exists on a warm daemon).
  seedDefaultSpace();
});

describe("Spaces / schema bootstrap", () => {
  it("creates spaces and space_transitions tables", () => {
    const tables = memoryDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("spaces");
    expect(names).toContain("space_transitions");
  });
});

describe("Spaces / bootstrap seed", () => {
  it("seeds the default personal space and is idempotent", () => {
    const first = seedDefaultSpace();
    const second = seedDefaultSpace();
    expect(first.slug).toBe("personal");
    expect(second.id).toBe(first.id);

    const all = listSpaces();
    const personals = all.filter((s) => s.slug === "personal");
    expect(personals).toHaveLength(1);
  });
});

describe("Spaces / createSpace", () => {
  it("persists an active space and emits space:created", () => {
    const events: string[] = [];
    const listener = (): void => {
      events.push("space:created");
    };
    spacesEvents.on("space:created", listener);

    const space = createSpace({
      slug: "work",
      name: "Work",
      description: "Client projects",
      actor: "user:trajan",
    });

    expect(space.id).toMatch(/^space_/u);
    expect(space.status).toBe("active");
    expect(space.slug).toBe("work");
    expect(events).toContain("space:created");
    spacesEvents.off("space:created", listener);

    const roundtrip = getSpace(space.id);
    expect(roundtrip?.name).toBe("Work");
    expect(roundtrip?.description).toBe("Client projects");

    // One transition row: draft -> active on creation.
    const transitions = listTransitions(space.id);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.to_status).toBe("active");
    expect(transitions[0]?.reason).toBe("created");
  });

  it("rejects duplicate slugs with SpaceSlugTakenError", () => {
    createSpace({ slug: "research", name: "Research", actor: "u" });
    expect(() =>
      createSpace({ slug: "research", name: "Research Two", actor: "u" }),
    ).toThrow(SpaceSlugTakenError);
  });

  it("creates a draft space when activate: false", () => {
    const space = createSpace({
      slug: "draft-space",
      name: "Draft",
      actor: "u",
      activate: false,
    });
    expect(space.status).toBe("draft");
  });
});

describe("Spaces / listSpaces + getSpace", () => {
  it("hides archived by default, shows with include_archived", () => {
    const a = createSpace({ slug: "alpha", name: "Alpha", actor: "u" });
    createSpace({ slug: "beta", name: "Beta", actor: "u" });
    archiveSpace(a.id, { actor: "u", reason: "done" });

    const defaultList = listSpaces();
    const activeSlugs = defaultList.map((s) => s.slug).sort();
    // personal (seeded) + beta; alpha is archived and hidden
    expect(activeSlugs).toEqual(["beta", "personal"]);

    const fullList = listSpaces({ include_archived: true });
    expect(fullList.map((s) => s.slug).sort()).toEqual([
      "alpha",
      "beta",
      "personal",
    ]);

    const onlyArchived = listSpaces({ status: "archived" });
    expect(onlyArchived).toHaveLength(1);
    expect(onlyArchived[0]?.slug).toBe("alpha");
  });

  it("resolves getSpace by id and by slug", () => {
    const space = createSpace({ slug: "hq", name: "HQ", actor: "u" });
    expect(getSpace(space.id)?.slug).toBe("hq");
    expect(getSpace("hq")?.id).toBe(space.id);
    expect(getSpace("nonexistent")).toBeNull();
  });
});

describe("Spaces / state transitions", () => {
  it("archiveSpace transitions active → archived", () => {
    const space = createSpace({ slug: "ephemeral", name: "E", actor: "u" });
    const archived = archiveSpace(space.id, {
      actor: "u",
      reason: "no longer needed",
    });
    expect(archived.status).toBe("archived");
    expect(archived.archived_at).not.toBeNull();

    const transitions = listTransitions(space.id);
    // created + archived
    expect(transitions.length).toBeGreaterThanOrEqual(2);
    const last = transitions[transitions.length - 1];
    expect(last?.to_status).toBe("archived");
    expect(last?.reason).toBe("no longer needed");
  });

  it("rejects archived → archived (terminal state)", () => {
    const space = createSpace({ slug: "once", name: "Once", actor: "u" });
    archiveSpace(space.id, { actor: "u" });
    expect(() => archiveSpace(space.id, { actor: "u" })).toThrow(
      InvalidSpaceTransitionError,
    );
    expect(canTransition("archived", "archived")).toBe(false);
    expect(canTransition("draft", "active")).toBe(true);
    expect(canTransition("active", "archived")).toBe(true);
  });
});

describe("Spaces / membership", () => {
  it("adds and removes members with event emission", () => {
    const added: string[] = [];
    const removed: string[] = [];
    spacesEvents.on("space:member_added", () => added.push("add"));
    spacesEvents.on("space:member_removed", () => removed.push("rm"));

    const space = createSpace({ slug: "team", name: "Team", actor: "u" });
    const withAlice = addMember(space.id, {
      actor: "u",
      member: { actor_id: "actor:alice", role: "owner" },
    });
    expect(withAlice.members).toHaveLength(1);
    expect(withAlice.members[0]?.actor_id).toBe("actor:alice");
    expect(withAlice.members[0]?.role).toBe("owner");

    const withoutAlice = removeMember(space.id, {
      actor: "u",
      actor_id: "actor:alice",
    });
    expect(withoutAlice.members).toHaveLength(0);

    expect(added).toHaveLength(1);
    expect(removed).toHaveLength(1);
  });

  it("refuses member mutations on archived spaces", () => {
    const space = createSpace({ slug: "frozen", name: "Frozen", actor: "u" });
    archiveSpace(space.id, { actor: "u" });
    expect(() =>
      addMember(space.id, {
        actor: "u",
        member: { actor_id: "actor:bob", role: "member" },
      }),
    ).toThrow(InvalidSpaceMutationError);
  });
});
