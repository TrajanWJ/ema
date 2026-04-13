import { useState } from "react";
import { useGitSyncStore } from "@/stores/git-sync-store";
import type { GitEvent, WikiSyncAction } from "@/types/git-sync";

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function repoName(path: string): string {
  return path.split("/").pop() ?? path;
}

function statusBadge(status: string): string {
  switch (status) {
    case "A": return "added";
    case "M": return "modified";
    case "D": return "deleted";
    case "R": return "renamed";
    default: return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "A": return "#2dd4a8";
    case "M": return "#6b95f0";
    case "D": return "#f43f5e";
    case "R": return "#f59e0b";
    default: return "var(--pn-text-tertiary)";
  }
}

function actionTypeLabel(type: string): string {
  switch (type) {
    case "create_stub": return "Create Stub";
    case "flag_outdated": return "Outdated";
    case "update_content": return "Update";
    default: return type;
  }
}

function actionTypeColor(type: string): string {
  switch (type) {
    case "create_stub": return "#2dd4a8";
    case "flag_outdated": return "#f59e0b";
    case "update_content": return "#6b95f0";
    default: return "var(--pn-text-tertiary)";
  }
}

function SyncHealthBar() {
  const syncStatus = useGitSyncStore((s) => s.syncStatus);

  if (!syncStatus) return null;

  const pending = syncStatus.pending_suggestions;
  const stale = syncStatus.stale_pages;
  const score = pending === 0 && stale === 0 ? 100 : Math.max(0, 100 - (pending * 5) - (stale * 10));

  return (
    <div className="glass-surface rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: "var(--pn-text-primary)" }}>
          Sync Health
        </span>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          style={{
            color: score > 70 ? "#2dd4a8" : score > 40 ? "#f59e0b" : "#f43f5e",
            background: score > 70 ? "rgba(45,212,168,0.1)" : score > 40 ? "rgba(245,158,11,0.1)" : "rgba(244,63,94,0.1)",
          }}
        >
          {score}%
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--pn-border-subtle)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            background: score > 70 ? "#2dd4a8" : score > 40 ? "#f59e0b" : "#f43f5e",
          }}
        />
      </div>
      <div className="flex gap-4 mt-2">
        <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>
          {pending} pending suggestions
        </span>
        <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>
          {stale} stale pages
        </span>
        <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>
          {syncStatus.watched_repos.length} repos watched
        </span>
      </div>
    </div>
  );
}

function SuggestionCard({
  action,
  eventId,
}: {
  readonly action: WikiSyncAction;
  readonly eventId: string;
}) {
  const applySuggestion = useGitSyncStore((s) => s.applySuggestion);
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    setApplying(true);
    try {
      await applySuggestion(eventId, action.id);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className="rounded px-3 py-2 flex items-start gap-3"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--pn-border-subtle)" }}
    >
      <span
        className="text-[0.65rem] font-mono px-1.5 py-0.5 rounded shrink-0 mt-0.5"
        style={{
          color: actionTypeColor(action.action_type),
          background: `${actionTypeColor(action.action_type)}15`,
        }}
      >
        {actionTypeLabel(action.action_type)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono truncate" style={{ color: "var(--pn-text-secondary)" }}>
          {action.wiki_path}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--pn-text-tertiary)" }}>
          {action.suggestion}
        </div>
      </div>
      {!action.auto_applied ? (
        <button
          onClick={handleApply}
          disabled={applying}
          className="shrink-0 text-xs px-2 py-1 rounded transition-colors hover:bg-white/5"
          style={{
            color: "#2dd4a8",
            border: "1px solid rgba(45,212,168,0.3)",
            opacity: applying ? 0.5 : 1,
          }}
        >
          {applying ? "..." : "Apply"}
        </button>
      ) : (
        <span className="shrink-0 text-xs px-2 py-1" style={{ color: "var(--pn-text-muted)" }}>
          Applied
        </span>
      )}
    </div>
  );
}

function CommitCard({ event }: { readonly event: GitEvent }) {
  const [expanded, setExpanded] = useState(false);
  const files = event.changed_files?.files ?? [];
  const pendingActions = event.sync_actions.filter((a) => !a.auto_applied);

  return (
    <div
      className="glass-surface rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--pn-border-subtle)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-mono"
            style={{ background: "rgba(107,149,240,0.1)", color: "#6b95f0" }}
          >
            {event.commit_sha.slice(0, 4)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm truncate" style={{ color: "var(--pn-text-primary)" }}>
                {event.message}
              </span>
              {pendingActions.length > 0 && (
                <span
                  className="text-[0.6rem] px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                >
                  {pendingActions.length} suggestion{pendingActions.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono" style={{ color: "var(--pn-text-muted)" }}>
                {event.commit_sha.slice(0, 8)}
              </span>
              <span className="text-xs" style={{ color: "var(--pn-text-tertiary)" }}>
                {event.author}
              </span>
              <span
                className="text-[0.65rem] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(107,149,240,0.08)", color: "#6b95f0" }}
              >
                {repoName(event.repo_path)}
              </span>
              <span className="text-xs ml-auto" style={{ color: "var(--pn-text-muted)" }}>
                {formatRelativeTime(event.inserted_at)}
              </span>
            </div>
          </div>
          <span
            className="text-xs shrink-0 transition-transform"
            style={{
              color: "var(--pn-text-muted)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            {"\u25B6"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: "1px solid var(--pn-border-subtle)" }}>
          {/* Changed Files */}
          {files.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--pn-text-secondary)" }}>
                Changed Files ({files.length})
              </div>
              <div className="flex flex-col gap-1">
                {files.map((f) => (
                  <div key={f.path} className="flex items-center gap-2 text-xs font-mono">
                    <span
                      className="px-1 py-0.5 rounded text-[0.6rem]"
                      style={{ color: statusColor(f.status), background: `${statusColor(f.status)}10` }}
                    >
                      {statusBadge(f.status)}
                    </span>
                    <span style={{ color: "var(--pn-text-tertiary)" }}>{f.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diff Summary */}
          {event.diff_summary && (
            <div className="mb-3">
              <div className="text-xs font-medium mb-1" style={{ color: "var(--pn-text-secondary)" }}>
                Diff Summary
              </div>
              <pre
                className="text-[0.65rem] font-mono p-2 rounded overflow-x-auto"
                style={{ color: "var(--pn-text-tertiary)", background: "rgba(0,0,0,0.2)" }}
              >
                {event.diff_summary}
              </pre>
            </div>
          )}

          {/* Suggestions */}
          {event.sync_actions.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--pn-text-secondary)" }}>
                Wiki Suggestions ({event.sync_actions.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {event.sync_actions.map((action) => (
                  <SuggestionCard key={action.id} action={action} eventId={event.id} />
                ))}
              </div>
            </div>
          )}

          {event.sync_actions.length === 0 && (
            <div className="text-xs" style={{ color: "var(--pn-text-muted)" }}>
              No wiki suggestions for this commit.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RepoFilter({
  repos,
  selected,
  onSelect,
}: {
  readonly repos: readonly string[];
  readonly selected: string | null;
  readonly onSelect: (repo: string | null) => void;
}) {
  const scanRepo = useGitSyncStore((s) => s.scanRepo);

  return (
    <div className="flex items-center gap-2 mb-3">
      <button
        onClick={() => onSelect(null)}
        className="text-xs px-2.5 py-1 rounded transition-colors"
        style={{
          color: selected === null ? "#2dd4a8" : "var(--pn-text-tertiary)",
          background: selected === null ? "rgba(45,212,168,0.1)" : "transparent",
          border: `1px solid ${selected === null ? "rgba(45,212,168,0.3)" : "var(--pn-border-subtle)"}`,
        }}
      >
        All
      </button>
      {repos.map((repo) => (
        <button
          key={repo}
          onClick={() => onSelect(repo === selected ? null : repo)}
          className="text-xs px-2.5 py-1 rounded transition-colors"
          style={{
            color: selected === repo ? "#6b95f0" : "var(--pn-text-tertiary)",
            background: selected === repo ? "rgba(107,149,240,0.1)" : "transparent",
            border: `1px solid ${selected === repo ? "rgba(107,149,240,0.3)" : "var(--pn-border-subtle)"}`,
          }}
        >
          {repoName(repo)}
        </button>
      ))}
      <button
        onClick={() => {
          const target = selected ?? repos[0];
          if (target) scanRepo(target);
        }}
        className="ml-auto text-xs px-2.5 py-1 rounded transition-colors hover:bg-white/5"
        style={{ color: "var(--pn-text-tertiary)", border: "1px solid var(--pn-border-subtle)" }}
      >
        Scan Now
      </button>
    </div>
  );
}

export function GitSyncPage() {
  const events = useGitSyncStore((s) => s.events);
  const syncStatus = useGitSyncStore((s) => s.syncStatus);
  const [repoFilter, setRepoFilter] = useState<string | null>(null);

  const repos = syncStatus?.watched_repos ?? [];
  const filtered = repoFilter
    ? events.filter((e) => e.repo_path === repoFilter)
    : events;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <SyncHealthBar />
      <RepoFilter repos={repos} selected={repoFilter} onSelect={setRepoFilter} />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <span className="text-2xl" style={{ color: "var(--pn-text-muted)" }}>{"\uD83D\uDD17"}</span>
          <span className="text-sm" style={{ color: "var(--pn-text-tertiary)" }}>
            No git events yet. Commits will appear here as they happen.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((event) => (
            <CommitCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
