import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const memoryDb = new Database(":memory:");
memoryDb.pragma("journal_mode = MEMORY");
memoryDb.pragma("foreign_keys = ON");

vi.mock("../../persistence/db.js", () => ({
  getDb: () => memoryDb,
  closeDb: () => memoryDb.close(),
}));

const {
  actOnFeedItem,
  getFeedItem,
  getFeedWorkspace,
  initFeeds,
  listFeedViews,
  seedFeedWorkspace,
  updateFeedViewPrompt,
} = await import("./service.js");

function resetDb(): void {
  memoryDb.exec(`
    DELETE FROM feed_conversations;
    DELETE FROM feed_item_actions;
    DELETE FROM feed_items;
    DELETE FROM feed_views;
    DELETE FROM feed_sources;
  `);
}

beforeAll(() => {
  initFeeds();
});

beforeEach(() => {
  resetDb();
  seedFeedWorkspace();
});

describe("Feeds / bootstrap", () => {
  it("seeds sources, views, and items", () => {
    const workspace = getFeedWorkspace();
    expect(workspace.sources.length).toBeGreaterThanOrEqual(4);
    expect(workspace.views.length).toBeGreaterThanOrEqual(6);
    expect(workspace.items.length).toBeGreaterThanOrEqual(1);
    expect(workspace.stats.total_items).toBeGreaterThanOrEqual(10);
  });

  it("returns scope-appropriate items for studio triage", () => {
    const workspace = getFeedWorkspace({
      surface: "triage",
      scope_id: "space:studio",
    });
    expect(workspace.surface).toBe("triage");
    expect(workspace.active_view_id).toBe("feed_view_triage_studio");
    expect(workspace.items.every((item) => item.status !== "hidden")).toBe(true);
    expect(
      workspace.items.some((item) => item.scope_ids.includes("space:studio")),
    ).toBe(true);
  });
});

describe("Feeds / prompt tuning", () => {
  it("updates a view prompt", () => {
    const before = listFeedViews().find(
      (view) => view.id === "feed_view_agent_personal",
    );
    const updated = updateFeedViewPrompt(
      "feed_view_agent_personal",
      "Bias hard toward build-ready feed infrastructure and explainable ranking.",
    );
    expect(updated.prompt).toContain("build-ready");
    expect(updated.updated_at).not.toBe(before?.updated_at);
  });
});

describe("Feeds / item actions", () => {
  it("saves an item and records the action", () => {
    const result = actOnFeedItem("feed_item_small_list_manifesto", {
      action: "save",
      actor: "user:test",
      note: "Worth keeping around.",
    });
    expect(result.item.status).toBe("saved");
    expect(result.action.action).toBe("save");

    const workspace = getFeedWorkspace({ scope_id: "personal" });
    expect(workspace.recent_actions[0]?.item_id).toBe("feed_item_small_list_manifesto");
  });

  it("creates a queued conversation for build actions", () => {
    const result = actOnFeedItem("feed_item_research_harness", {
      action: "queue_build",
      actor: "user:test",
    });
    expect(result.item.status).toBe("acted_on");
    expect(result.conversation?.suggested_mode).toBe("build");
    expect(result.conversation?.status).toBe("queued");
  });

  it("shares an item into an org scope", () => {
    actOnFeedItem("feed_item_small_list_manifesto", {
      action: "share",
      actor: "user:test",
      target_scope_id: "org:ema",
    });
    const item = getFeedItem("feed_item_small_list_manifesto");
    expect(item?.scope_ids).toContain("org:ema");
  });
});
