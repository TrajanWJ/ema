import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ActivityTimeline, InspectorSection, TagPill } from "@ema/glass";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { GlassInput } from "@/components/ui/GlassInput";
import { api } from "@/lib/api";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["feeds"];

type FeedSurface = "reader" | "triage" | "agent";
type FeedScopeKind = "global" | "personal" | "space" | "organization" | "shared";
type FeedItemStatus = "fresh" | "saved" | "promoted" | "hidden" | "acted_on";
type FeedItemKind = "video" | "article" | "thread" | "repo" | "brief" | "note";
type FeedActionType =
  | "save"
  | "promote"
  | "hide"
  | "dismiss"
  | "queue_research"
  | "queue_build"
  | "start_chat"
  | "share";

interface FeedScore {
  readonly overall: number;
  readonly novelty: number;
  readonly relevance: number;
  readonly signal: number;
  readonly recency: number;
  readonly serendipity: number;
}

interface FeedSource {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}

interface FeedView {
  readonly id: string;
  readonly title: string;
  readonly surface: FeedSurface;
  readonly scope_id: string;
  readonly scope_kind: FeedScopeKind;
  readonly prompt: string;
  readonly share_targets: readonly string[];
}

interface FeedItem {
  readonly id: string;
  readonly source_id: string;
  readonly canonical_url?: string | null;
  readonly title: string;
  readonly summary: string;
  readonly creator?: string | null;
  readonly kind: FeedItemKind;
  readonly status: FeedItemStatus;
  readonly score: FeedScore;
  readonly signals: readonly string[];
  readonly tags: readonly string[];
  readonly scope_ids: readonly string[];
  readonly available_actions: readonly FeedActionType[];
  readonly cover_color?: string | null;
  readonly metadata: Record<string, unknown>;
  readonly discovered_at: string;
  readonly published_at?: string | null;
  readonly ranked_score?: number | null;
  readonly rank_reasons?: readonly string[];
}

interface FeedAction {
  readonly id: string;
  readonly item_id: string;
  readonly action: FeedActionType;
  readonly actor: string;
  readonly note?: string | null;
  readonly target_scope_id?: string | null;
  readonly inserted_at: string;
}

interface FeedConversation {
  readonly id: string;
  readonly item_id: string;
  readonly title: string;
  readonly suggested_mode: "chat" | "research" | "build" | "brief";
  readonly opener: string;
  readonly status: "open" | "queued" | "resolved";
  readonly inserted_at: string;
  readonly updated_at: string;
}

interface FeedWorkspace {
  readonly surface: FeedSurface;
  readonly scope_id: string;
  readonly active_view_id: string;
  readonly query: string;
  readonly sources: readonly FeedSource[];
  readonly views: readonly FeedView[];
  readonly items: readonly FeedItem[];
  readonly recent_actions: readonly FeedAction[];
  readonly conversations: readonly FeedConversation[];
  readonly stats: {
    readonly total_items: number;
    readonly visible_items: number;
    readonly saved_items: number;
    readonly promoted_items: number;
    readonly hidden_items: number;
    readonly sources: number;
    readonly open_conversations: number;
  };
}

const SURFACES: readonly { id: FeedSurface; label: string; hint: string; tone: string }[] = [
  { id: "reader", label: "Reader", hint: "Curiosity stream", tone: "#60a5fa" },
  { id: "triage", label: "Triage", hint: "Decision queue", tone: "#2dd4a8" },
  { id: "agent", label: "Agent Console", hint: "Route into work", tone: "#f59e0b" },
];

function formatAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function scopeLabel(scopeId: string): string {
  if (scopeId === "personal") return "Personal";
  if (scopeId === "global") return "Global";
  if (scopeId.startsWith("space:")) {
    return scopeId.replace(/^space:/, "").replace(/-/g, " ");
  }
  if (scopeId.startsWith("org:")) {
    return scopeId.replace(/^org:/, "").replace(/-/g, " ");
  }
  return scopeId.replace(/-/g, " ");
}

function kindGlyph(kind: FeedItemKind): string {
  if (kind === "video") return "▶";
  if (kind === "article") return "¶";
  if (kind === "thread") return "≋";
  if (kind === "repo") return "⌘";
  if (kind === "brief") return "◆";
  return "•";
}

function sourceTone(kind: FeedItemKind, fallback?: string | null): string {
  if (fallback) return fallback;
  if (kind === "video") return "#ec4899";
  if (kind === "article") return "#3b82f6";
  if (kind === "repo") return "#22c55e";
  if (kind === "thread") return "#06b6d4";
  if (kind === "brief") return "#8b5cf6";
  return "#f59e0b";
}

function actionLabel(action: FeedActionType, targetScopeId?: string | null): string {
  if (action === "queue_research") return "Research";
  if (action === "queue_build") return "Build";
  if (action === "start_chat") return "Chat";
  if (action === "promote") return "Promote";
  if (action === "hide" || action === "dismiss") return "Hide";
  if (action === "share") return targetScopeId ? `Share to ${scopeLabel(targetScopeId)}` : "Share";
  return "Save";
}

function statusTone(status: FeedItemStatus): string {
  if (status === "saved") return "#60a5fa";
  if (status === "promoted") return "#a78bfa";
  if (status === "acted_on") return "#22c55e";
  if (status === "hidden") return "#64748b";
  return "rgba(255,255,255,0.56)";
}

function metadataLine(item: FeedItem): string | null {
  const entries = Object.entries(item.metadata);
  if (entries.length === 0) return null;
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key.replace(/_/g, " ")} ${String(value)}`)
    .join(" · ");
}

function topReasons(item: FeedItem): string {
  return item.rank_reasons?.slice(0, 2).join(" · ") ?? "Ranked from hybrid signal, relevance, and recency.";
}

function itemHeadline(item: FeedItem): string {
  if (item.kind === "video") return "Watch this";
  if (item.kind === "repo") return "Steal the pattern";
  if (item.kind === "thread") return "Thread worth extracting";
  if (item.kind === "brief") return "Operational brief";
  return "Read this";
}

export function FeedsApp() {
  const [workspace, setWorkspace] = useState<FeedWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surface, setSurface] = useState<FeedSurface>("reader");
  const [scopeId, setScopeId] = useState("personal");
  const [viewId, setViewId] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const deferredQuery = useDeferredValue(queryInput);

  async function loadWorkspace(next?: Partial<{
    surface: FeedSurface;
    scopeId: string;
    viewId: string | null;
    query: string;
    includeHidden: boolean;
  }>) {
    const params = new URLSearchParams();
    const nextSurface = next?.surface ?? surface;
    const nextScopeId = next?.scopeId ?? scopeId;
    const nextViewId = next?.viewId ?? viewId;
    const nextQuery = next?.query ?? deferredQuery;
    const nextIncludeHidden = next?.includeHidden ?? includeHidden;

    params.set("surface", nextSurface);
    params.set("scope_id", nextScopeId);
    if (nextViewId) params.set("view_id", nextViewId);
    if (nextQuery.trim()) params.set("query", nextQuery.trim());
    if (nextIncludeHidden) params.set("include_hidden", "true");

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{ workspace: FeedWorkspace }>(
        `/feeds?${params.toString()}`,
      );
      startTransition(() => {
        setWorkspace(response.workspace);
        setSurface(response.workspace.surface);
        setScopeId(response.workspace.scope_id);
        setViewId(response.workspace.active_view_id);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feeds");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [surface, scopeId, viewId, deferredQuery, includeHidden]);

  useEffect(() => {
    if (!workspace) return;
    const activeView =
      workspace.views.find((candidate) => candidate.id === workspace.active_view_id) ?? null;
    setPromptDraft(activeView?.prompt ?? "");
  }, [workspace?.active_view_id, workspace]);

  const activeView = useMemo(
    () =>
      workspace?.views.find((candidate) => candidate.id === workspace.active_view_id) ?? null,
    [workspace],
  );

  const visibleScopes = useMemo(() => {
    const currentViews = (workspace?.views ?? []).filter((candidate) => candidate.surface === surface);
    const entries = currentViews.map((candidate) => ({
      id: candidate.scope_id,
      kind: candidate.scope_kind,
    }));
    return entries.filter(
      (candidate, index) =>
        entries.findIndex((entry) => entry.id === candidate.id) === index,
    );
  }, [workspace, surface]);

  const scopedViews = useMemo(
    () =>
      (workspace?.views ?? []).filter(
        (candidate) =>
          candidate.surface === surface && candidate.scope_id === scopeId,
      ),
    [workspace, scopeId, surface],
  );

  const sourceMap = useMemo(
    () => new Map((workspace?.sources ?? []).map((source) => [source.id, source])),
    [workspace],
  );

  const items = workspace?.items ?? [];
  const featuredItem = items[0] ?? null;
  const secondaryItems = items.slice(1, 4);
  const streamItems = items.slice(4);
  const surfaceMeta = SURFACES.find((entry) => entry.id === surface) ?? SURFACES[0];

  async function handleSavePrompt() {
    if (!activeView) return;
    setSavingPrompt(true);
    try {
      await api.put<{ view: FeedView }>(
        `/feeds/views/${encodeURIComponent(activeView.id)}/prompt`,
        { prompt: promptDraft },
      );
      await loadWorkspace({ viewId: activeView.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update prompt");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function handleItemAction(itemId: string, action: FeedActionType) {
    setBusyItemId(itemId);
    const targetScopeId =
      action === "share"
        ? scopeId === "org:ema"
          ? "personal"
          : "org:ema"
        : null;

    try {
      await api.post(`/feeds/items/${encodeURIComponent(itemId)}/actions`, {
        action,
        actor: "user:trajan",
        target_scope_id: targetScopeId,
      });
      await loadWorkspace({ viewId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply action");
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <AppWindowChrome appId="feeds" title={config.title} icon={config.icon} accent={config.accent}>
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: 4,
          overflow: "hidden",
          background: [
            "radial-gradient(circle at 0% 0%, rgba(34,197,94,0.14), transparent 28%)",
            "radial-gradient(circle at 100% 0%, rgba(59,130,246,0.16), transparent 34%)",
            "radial-gradient(circle at 50% 100%, rgba(236,72,153,0.10), transparent 30%)",
          ].join(", "),
        }}
      >
        <div
          style={{
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, rgba(12,16,26,0.92), rgba(7,10,18,0.84))",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.36)",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <TopNav
            surface={surface}
            scopeId={scopeId}
            queryInput={queryInput}
            includeHidden={includeHidden}
            visibleScopes={visibleScopes}
            scopedViews={scopedViews}
            activeViewId={workspace?.active_view_id ?? null}
            onSurfaceChange={(nextSurface) => {
              setSurface(nextSurface);
              setViewId(null);
            }}
            onScopeChange={(nextScopeId) => {
              setScopeId(nextScopeId);
              setViewId(null);
            }}
            onQueryChange={setQueryInput}
            onToggleHidden={() => setIncludeHidden((value) => !value)}
            onViewChange={setViewId}
            workspace={workspace}
          />

          <div style={{ display: "flex", gap: 14, minHeight: 0, flex: 1 }}>
            <div style={{ flex: 1.8, minWidth: 0, display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.55fr) minmax(18rem, 0.95fr)",
                  gap: 14,
                }}
              >
                <HeroPanel
                  item={featuredItem}
                  sourceMap={sourceMap}
                  scopeId={scopeId}
                  busyItemId={busyItemId}
                  onItemAction={handleItemAction}
                />

                <ControlTower
                  activeView={activeView}
                  promptDraft={promptDraft}
                  savingPrompt={savingPrompt}
                  onPromptChange={setPromptDraft}
                  onSavePrompt={handleSavePrompt}
                  stats={workspace?.stats ?? null}
                  surfaceMeta={surfaceMeta}
                  error={error}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {secondaryItems.map((item) => (
                  <FeatureMiniCard
                    key={item.id}
                    item={item}
                    source={sourceMap.get(item.source_id) ?? null}
                    busy={busyItemId === item.id}
                    scopeId={scopeId}
                    onItemAction={handleItemAction}
                  />
                ))}
              </div>

              <div
                style={{
                  minHeight: 0,
                  overflow: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  paddingRight: 4,
                }}
              >
                {loading && (
                  <ModernPanel>
                    <div style={{ color: "rgba(255,255,255,0.68)", fontSize: 13 }}>Loading feed workspace…</div>
                  </ModernPanel>
                )}

                {!loading && !error && !featuredItem && (
                  <ModernPanel>
                    <div style={{ color: "rgba(255,255,255,0.68)", fontSize: 13 }}>
                      No items matched this surface. Change the view, prompt, or search terms.
                    </div>
                  </ModernPanel>
                )}

                {!loading &&
                  streamItems.map((item, index) => (
                    <StreamCard
                      key={item.id}
                      item={item}
                      source={sourceMap.get(item.source_id) ?? null}
                      busy={busyItemId === item.id}
                      scopeId={scopeId}
                      accentIndex={index}
                      onItemAction={handleItemAction}
                    />
                  ))}
              </div>
            </div>

            <div style={{ width: 360, minWidth: 320, display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
              <ModernPanel>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.46)",
                    marginBottom: 8,
                  }}
                >
                  Queue Snapshot
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <MetricChip label="Visible" value={String(workspace?.stats.visible_items ?? 0)} />
                  <MetricChip label="Saved" value={String(workspace?.stats.saved_items ?? 0)} />
                  <MetricChip label="Promoted" value={String(workspace?.stats.promoted_items ?? 0)} />
                  <MetricChip label="Sources" value={String(workspace?.stats.sources ?? 0)} />
                </div>
              </ModernPanel>

              <ModernPanel className="flex-1">
                <InspectorSection
                  title="Recent Actions"
                  description="Operator actions taken against the current feed workspace."
                >
                  <ActivityTimeline
                    items={(workspace?.recent_actions ?? []).slice(0, 7).map((action) => ({
                      id: action.id,
                      title: actionLabel(action.action, action.target_scope_id),
                      meta: `${action.actor} · ${formatAgo(action.inserted_at)}`,
                      body: action.note ?? "No note attached.",
                      tone: "#60a5fa",
                    }))}
                    emptyLabel="No feed actions yet."
                  />
                </InspectorSection>
              </ModernPanel>

              <ModernPanel className="flex-1">
                <InspectorSection
                  title="Open Conversations"
                  description="Research, build, and chat threads spawned from feed items."
                >
                  <ActivityTimeline
                    items={(workspace?.conversations ?? []).slice(0, 7).map((conversation) => ({
                      id: conversation.id,
                      title: conversation.title,
                      meta: `${conversation.suggested_mode} · ${conversation.status} · ${formatAgo(conversation.updated_at)}`,
                      body: conversation.opener,
                      tone: "#f59e0b",
                    }))}
                    emptyLabel="No feed conversations yet."
                  />
                </InspectorSection>
              </ModernPanel>
            </div>
          </div>
        </div>
      </div>
    </AppWindowChrome>
  );
}

function TopNav({
  surface,
  scopeId,
  queryInput,
  includeHidden,
  visibleScopes,
  scopedViews,
  activeViewId,
  onSurfaceChange,
  onScopeChange,
  onQueryChange,
  onToggleHidden,
  onViewChange,
  workspace,
}: {
  surface: FeedSurface;
  scopeId: string;
  queryInput: string;
  includeHidden: boolean;
  visibleScopes: readonly { id: string; kind: FeedScopeKind }[];
  scopedViews: readonly FeedView[];
  activeViewId: string | null;
  onSurfaceChange: (nextSurface: FeedSurface) => void;
  onScopeChange: (nextScopeId: string) => void;
  onQueryChange: (value: string) => void;
  onToggleHidden: () => void;
  onViewChange: (nextViewId: string) => void;
  workspace: FeedWorkspace | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: [
          "linear-gradient(120deg, rgba(34,197,94,0.12), transparent 24%)",
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))",
        ].join(", "),
        padding: 14,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ minWidth: 220 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.42)",
              marginBottom: 4,
            }}
          >
            EMA FeedOS
          </div>
          <div style={{ fontSize: 26, fontWeight: 650, lineHeight: 1.05 }}>
            Promptable social replacement
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
          {SURFACES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSurfaceChange(entry.id)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.1)",
                background:
                  surface === entry.id
                    ? `${entry.tone}22`
                    : "rgba(255,255,255,0.04)",
                color: surface === entry.id ? entry.tone : "rgba(255,255,255,0.68)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                minWidth: 132,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{entry.label}</span>
              <span style={{ fontSize: 11, opacity: 0.82 }}>{entry.hint}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SignalBadge text={`${workspace?.stats.sources ?? 0} sources`} tone="#2dd4a8" />
          <SignalBadge text="Hybrid rank" tone="#60a5fa" />
          <SignalBadge text="Promptable algo" tone="#f59e0b" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {visibleScopes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onScopeChange(entry.id)}
              style={{
                padding: "7px 11px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.08)",
                background:
                  scopeId === entry.id
                    ? "rgba(45,212,168,0.18)"
                    : "rgba(255,255,255,0.03)",
                color:
                  scopeId === entry.id ? "#6ee7b7" : "rgba(255,255,255,0.66)",
                cursor: "pointer",
                fontSize: 12,
                textTransform: "capitalize",
              }}
            >
              {scopeLabel(entry.id)}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <GlassInput
            value={queryInput}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search signals, analogies, repos, moods..."
            className="flex-1"
            uiSize="sm"
          />
          <button
            type="button"
            onClick={onToggleHidden}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.10)",
              background: includeHidden ? "rgba(248,113,113,0.17)" : "rgba(255,255,255,0.04)",
              color: includeHidden ? "#fca5a5" : "rgba(255,255,255,0.66)",
              cursor: "pointer",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            {includeHidden ? "Noise Visible" : "Hide Noise"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {scopedViews.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onViewChange(candidate.id)}
            style={{
              padding: "7px 11px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background:
                activeViewId === candidate.id
                  ? "rgba(168,85,247,0.18)"
                  : "rgba(255,255,255,0.03)",
              color:
                activeViewId === candidate.id
                  ? "#d8b4fe"
                  : "rgba(255,255,255,0.68)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {candidate.title}
          </button>
        ))}

        <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.44)", fontSize: 11 }}>
          {workspace?.stats.visible_items ?? 0} visible · {workspace?.stats.total_items ?? 0} total
        </div>
      </div>
    </div>
  );
}

function HeroPanel({
  item,
  sourceMap,
  scopeId,
  busyItemId,
  onItemAction,
}: {
  item: FeedItem | null;
  sourceMap: Map<string, FeedSource>;
  scopeId: string;
  busyItemId: string | null;
  onItemAction: (itemId: string, action: FeedActionType) => Promise<void>;
}) {
  if (!item) {
    return (
      <ModernPanel>
        <div style={{ color: "rgba(255,255,255,0.68)" }}>No featured item yet.</div>
      </ModernPanel>
    );
  }

  const source = sourceMap.get(item.source_id);
  const tone = sourceTone(item.kind, item.cover_color);

  return (
    <div
      style={{
        position: "relative",
        minHeight: 290,
        borderRadius: 28,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: [
          `radial-gradient(circle at 100% 0%, ${tone}3a, transparent 34%)`,
          "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
          "linear-gradient(135deg, rgba(6,8,18,0.92), rgba(9,11,22,0.84))",
        ].join(", "),
        boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -60,
          top: -40,
          width: 240,
          height: 240,
          borderRadius: "50%",
          background: `${tone}18`,
          filter: "blur(10px)",
        }}
      />
      <div style={{ position: "relative", padding: 22, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 10,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.48)",
              }}
            >
              <span>{kindGlyph(item.kind)}</span>
              <span>{source?.name ?? item.kind}</span>
              <span>{itemHeadline(item)}</span>
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.02, fontWeight: 650, maxWidth: 720 }}>
              {item.title}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "end", gap: 8 }}>
            <ScoreBadge label="score" value={item.ranked_score?.toFixed(3) ?? item.score.overall.toFixed(3)} />
            <ScoreBadge label="freshness" value={formatAgo(item.discovered_at)} />
          </div>
        </div>

        <div style={{ maxWidth: 760, color: "rgba(255,255,255,0.76)", lineHeight: 1.6, fontSize: 15 }}>
          {item.summary}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {item.signals.map((signal) => (
            <Tag key={signal} label={signal} tone="rgba(255,255,255,0.08)" color="rgba(255,255,255,0.82)" />
          ))}
          {item.tags.map((tag) => (
            <Tag key={tag} label={tag} tone={`${tone}20`} color={tone} />
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {item.available_actions.slice(0, 5).map((action) => {
            const sharingTarget =
              action === "share"
                ? scopeId === "org:ema"
                  ? "personal"
                  : "org:ema"
                : null;
            return (
              <ActionButton
                key={action}
                busy={busyItemId === item.id}
                label={busyItemId === item.id ? "Working…" : actionLabel(action, sharingTarget)}
                tone={tone}
                onClick={() => void onItemAction(item.id, action)}
              />
            );
          })}

          {item.canonical_url && (
            <a
              href={item.canonical_url}
              target="_blank"
              rel="noreferrer"
              style={{
                marginLeft: "auto",
                textDecoration: "none",
                color: "rgba(255,255,255,0.68)",
                fontSize: 12,
              }}
            >
              Open source ↗
            </a>
          )}
        </div>

        <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>
          Why it’s leading: {topReasons(item)}
        </div>
      </div>
    </div>
  );
}

function ControlTower({
  activeView,
  promptDraft,
  savingPrompt,
  onPromptChange,
  onSavePrompt,
  stats,
  surfaceMeta,
  error,
}: {
  activeView: FeedView | null;
  promptDraft: string;
  savingPrompt: boolean;
  onPromptChange: (value: string) => void;
  onSavePrompt: () => Promise<void>;
  stats: FeedWorkspace["stats"] | null;
  surfaceMeta: (typeof SURFACES)[number];
  error: string | null;
}) {
  return (
    <ModernPanel>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.44)",
              marginBottom: 6,
            }}
          >
            Algorithm Studio
          </div>
          <div style={{ fontSize: 21, fontWeight: 650, lineHeight: 1.1 }}>
            {activeView?.title ?? "No active view"}
          </div>
          <div style={{ color: surfaceMeta.tone, fontSize: 12, marginTop: 4 }}>
            {surfaceMeta.label} · {surfaceMeta.hint}
          </div>
        </div>

        <textarea
          value={promptDraft}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Describe how this feed should think..."
          style={{
            minHeight: 150,
            resize: "vertical",
            borderRadius: 16,
            padding: 14,
            background: "rgba(8,10,18,0.72)",
            color: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
            outline: "none",
            lineHeight: 1.6,
            fontSize: 13,
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <MetricChip label="Saved" value={String(stats?.saved_items ?? 0)} />
          <MetricChip label="Convos" value={String(stats?.open_conversations ?? 0)} />
        </div>

        <button
          type="button"
          onClick={() => void onSavePrompt()}
          disabled={savingPrompt || !activeView}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(45,212,168,0.24)",
            background: "linear-gradient(180deg, rgba(34,197,94,0.18), rgba(45,212,168,0.1))",
            color: "#bbf7d0",
            cursor: "pointer",
            opacity: savingPrompt || !activeView ? 0.58 : 1,
            fontWeight: 600,
          }}
        >
          {savingPrompt ? "Retuning…" : "Retune View"}
        </button>

        <div style={{ color: "rgba(255,255,255,0.54)", fontSize: 12, lineHeight: 1.5 }}>
          The prompt is part of the ranking model. Change it to bias taste, urgency, signal density, or buildability.
        </div>

        {error && (
          <div style={{ color: "#fca5a5", fontSize: 12, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
      </div>
    </ModernPanel>
  );
}

function FeatureMiniCard({
  item,
  source,
  busy,
  scopeId,
  onItemAction,
}: {
  item: FeedItem;
  source: FeedSource | null;
  busy: boolean;
  scopeId: string;
  onItemAction: (itemId: string, action: FeedActionType) => Promise<void>;
}) {
  const tone = sourceTone(item.kind, item.cover_color);
  const primaryAction = item.available_actions[0] ?? "save";
  const sharingTarget = scopeId === "org:ema" ? "personal" : "org:ema";

  return (
    <ModernPanel
      style={{
        background: [
          `linear-gradient(135deg, ${tone}18, transparent 38%)`,
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        ].join(", "),
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            {kindGlyph(item.kind)} {source?.name ?? item.kind}
          </div>
          <div style={{ color: statusTone(item.status), fontSize: 11 }}>
            {item.status}
          </div>
        </div>

        <div style={{ fontSize: 17, fontWeight: 620, lineHeight: 1.15 }}>
          {item.title}
        </div>

        <div style={{ color: "rgba(255,255,255,0.68)", fontSize: 13, lineHeight: 1.5 }}>
          {item.summary}
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <ActionButton
            busy={busy}
            label={busy ? "Working…" : actionLabel(primaryAction, primaryAction === "share" ? sharingTarget : null)}
            tone={tone}
            onClick={() => void onItemAction(item.id, primaryAction)}
          />
          <span style={{ color: "rgba(255,255,255,0.44)", fontSize: 11 }}>
            {formatAgo(item.discovered_at)}
          </span>
        </div>
      </div>
    </ModernPanel>
  );
}

function StreamCard({
  item,
  source,
  busy,
  scopeId,
  accentIndex,
  onItemAction,
}: {
  item: FeedItem;
  source: FeedSource | null;
  busy: boolean;
  scopeId: string;
  accentIndex: number;
  onItemAction: (itemId: string, action: FeedActionType) => Promise<void>;
}) {
  const tone = sourceTone(item.kind, item.cover_color);
  const leftStripe = [tone, "#60a5fa", "#f59e0b", "#2dd4a8"][accentIndex % 4] ?? tone;

  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(15,18,30,0.78), rgba(10,12,22,0.72))",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "6px minmax(0, 1fr)" }}>
        <div style={{ background: `linear-gradient(180deg, ${leftStripe}, transparent)` }} />
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
            <div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 8,
                  color: "rgba(255,255,255,0.46)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                <span>{kindGlyph(item.kind)}</span>
                <span>{source?.name ?? item.kind}</span>
                <span>{item.creator ?? "Unknown creator"}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 620, lineHeight: 1.14, marginBottom: 8 }}>
                {item.title}
              </div>
              <div style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.6, fontSize: 14 }}>
                {item.summary}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "end", gap: 8 }}>
              <span
                style={{
                  padding: "5px 8px",
                  borderRadius: 999,
                  border: `1px solid ${statusTone(item.status)}44`,
                  background: `${statusTone(item.status)}18`,
                  color: statusTone(item.status),
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                {item.status.replace("_", " ")}
              </span>
              <span style={{ color: "rgba(255,255,255,0.46)", fontSize: 11 }}>
                {(item.ranked_score ?? item.score.overall).toFixed(3)}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {item.signals.map((signal) => (
              <Tag key={signal} label={signal} tone="rgba(255,255,255,0.06)" color="rgba(255,255,255,0.78)" />
            ))}
            {item.tags.map((tag) => (
              <Tag key={tag} label={tag} tone={`${tone}20`} color={tone} />
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "rgba(255,255,255,0.52)", fontSize: 12 }}>
              {metadataLine(item) ?? topReasons(item)}
            </div>
            <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 11 }}>
              {formatAgo(item.discovered_at)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {item.available_actions.slice(0, 4).map((action) => {
              const sharingTarget =
                action === "share"
                  ? scopeId === "org:ema"
                    ? "personal"
                    : "org:ema"
                  : null;
              return (
                <ActionButton
                  key={action}
                  busy={busy}
                  label={busy ? "Working…" : actionLabel(action, sharingTarget)}
                  tone={tone}
                  onClick={() => void onItemAction(item.id, action)}
                />
              );
            })}

            {item.canonical_url && (
              <a
                href={item.canonical_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginLeft: "auto",
                  textDecoration: "none",
                  color: "rgba(255,255,255,0.58)",
                  fontSize: 12,
                }}
              >
                Open source ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModernPanel({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(16,20,31,0.82), rgba(9,11,22,0.74))",
        padding: 16,
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.03)",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.42)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 640 }}>{value}</div>
    </div>
  );
}

function SignalBadge({ text, tone }: { text: string; tone: string }) {
  return (
    <span
      style={{
        padding: "7px 10px",
        borderRadius: 999,
        border: `1px solid ${tone}33`,
        background: `${tone}18`,
        color: tone,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {text}
    </span>
  );
}

function Tag({
  label,
  tone,
  color,
}: {
  label: string;
  tone: string;
  color: string;
}) {
  return <TagPill label={label} tone={tone} color={color} />;
}

function ScoreBadge({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        minWidth: 88,
        textAlign: "right",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,0.42)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 620 }}>{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  tone,
  busy,
  onClick,
}: {
  label: string;
  tone: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        padding: "8px 11px",
        borderRadius: 10,
        border: `1px solid ${tone}2f`,
        background: `${tone}15`,
        color: tone,
        cursor: "pointer",
        fontSize: 12,
        opacity: busy ? 0.58 : 1,
      }}
    >
      {label}
    </button>
  );
}
