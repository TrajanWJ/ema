import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["intent-schematic"];

interface IntentRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly level: string;
  readonly status: string;
  readonly kind: string | null;
  readonly phase: string | null;
  readonly parent_id: string | null;
  readonly project_id: string | null;
  readonly tags?: readonly string[];
  readonly scope?: readonly string[];
  readonly exit_condition?: string | null;
}

interface IntentTreeNode {
  readonly intent: IntentRecord;
  readonly children: readonly IntentTreeNode[];
}

interface IntentLinkRecord {
  readonly id: string;
  readonly source_slug: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly relation: string;
  readonly provenance: string;
  readonly created_at: string;
}

interface IntentPhaseTransitionRecord {
  readonly id: string;
  readonly intent_slug: string;
  readonly from_phase: string | null;
  readonly to_phase: string;
  readonly reason: string;
  readonly summary: string | null;
  readonly transitioned_at: string;
}

interface IntentEventRecord {
  readonly id: string;
  readonly intent_slug: string;
  readonly event_type: string;
  readonly payload: Record<string, unknown>;
  readonly actor: string;
  readonly happened_at: string;
}

interface IntentRuntimeBundle {
  readonly intent: IntentRecord;
  readonly phase: string | null;
  readonly links: {
    readonly executions: readonly IntentLinkRecord[];
    readonly proposals: readonly IntentLinkRecord[];
    readonly actors: readonly IntentLinkRecord[];
    readonly sessions: readonly IntentLinkRecord[];
    readonly tasks: readonly IntentLinkRecord[];
    readonly canon: readonly IntentLinkRecord[];
  };
  readonly phase_transitions: readonly IntentPhaseTransitionRecord[];
  readonly recent_events: readonly IntentEventRecord[];
}

function labelize(value: string | null | undefined): string {
  if (!value) return "unassigned";
  return value.replace(/[_-]/g, " ");
}

function formatAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function flattenTree(nodes: readonly IntentTreeNode[]): IntentRecord[] {
  const result: IntentRecord[] = [];
  const visit = (node: IntentTreeNode) => {
    result.push(node.intent);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

export function IntentSchematicApp() {
  const [tree, setTree] = useState<readonly IntentTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<IntentRuntimeBundle | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creatingExecution, setCreatingExecution] = useState(false);

  async function loadTree() {
    setLoadingTree(true);
    setError(null);
    try {
      const data = await api.get<{ tree: IntentTreeNode[] }>("/intents/tree");
      setTree(data.tree ?? []);
      setSelectedId((current) => current ?? data.tree?.[0]?.intent.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "intent_tree_failed");
    } finally {
      setLoadingTree(false);
    }
  }

  async function loadBundle(intentId: string) {
    setLoadingBundle(true);
    setActionError(null);
    try {
      const data = await api.get<{ bundle: IntentRuntimeBundle }>(`/intents/${intentId}/runtime`);
      setBundle(data.bundle);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "intent_bundle_failed");
      setBundle(null);
    } finally {
      setLoadingBundle(false);
    }
  }

  useEffect(() => {
    void loadTree();
  }, []);

  useEffect(() => {
    if (selectedId) void loadBundle(selectedId);
  }, [selectedId]);

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const counts = {
    total: flat.length,
    active: flat.filter((item) => item.status === "active").length,
    implementing: flat.filter((item) => item.status === "implementing").length,
    blocked: flat.filter((item) => item.status === "blocked").length,
  };

  async function handleStartExecution() {
    if (!bundle) return;
    setCreatingExecution(true);
    setActionError(null);
    try {
      await api.post(`/intents/${bundle.intent.id}/executions`, {
        title: bundle.intent.title,
        objective: bundle.intent.description ?? bundle.intent.title,
        mode: bundle.intent.kind === "research" ? "research" : "implement",
      });
      await loadBundle(bundle.intent.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "execution_start_failed");
    } finally {
      setCreatingExecution(false);
    }
  }

  return (
    <AppWindowChrome
      appId="intent-schematic"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={bundle?.intent.title ?? "Intent Explorer"}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(45,212,168,0.05))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]" style={{ color: config.accent }}>
            Intent Runtime Graph
          </div>
          <div className="mt-1 text-[1rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            Inspect live intents and their proposal/execution attachments
          </div>
          <p className="mt-2 max-w-3xl text-[0.75rem] leading-[1.6]" style={{ color: "var(--pn-text-secondary)" }}>
            This app now uses the active `/api/intents` runtime surface directly. The old vault/wiki editing layer has been removed from this view because it was built on routes that are not part of the live backend spine.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MetricPill label="Total" value={counts.total} color="#a78bfa" />
            <MetricPill label="Active" value={counts.active} color="#2dd4a8" />
            <MetricPill label="Implementing" value={counts.implementing} color="#f59e0b" />
            <MetricPill label="Blocked" value={counts.blocked} color="#ef4444" />
          </div>
        </div>

        {error ? (
          <div className="rounded-xl px-3 py-2 text-[0.72rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {error}
          </div>
        ) : null}
        {actionError ? (
          <div className="rounded-xl px-3 py-2 text-[0.72rem]" style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24" }}>
            {actionError}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 gap-3">
          <div
            className="w-[23rem] shrink-0 overflow-y-auto rounded-2xl p-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-[0.58rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                Intent Tree
              </div>
              <button
                type="button"
                onClick={() => void loadTree()}
                className="rounded-lg px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em]"
                style={{ background: "rgba(255,255,255,0.04)", color: "var(--pn-text-secondary)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                Refresh
              </button>
            </div>
            {loadingTree ? (
              <div className="text-[0.74rem]" style={{ color: "var(--pn-text-muted)" }}>Loading intents...</div>
            ) : tree.length === 0 ? (
              <div className="text-[0.74rem]" style={{ color: "var(--pn-text-muted)" }}>No intents indexed.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {tree.map((node) => (
                  <TreeNodeButton
                    key={node.intent.id}
                    node={node}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {loadingBundle ? (
              <Empty label="Loading runtime bundle..." />
            ) : !bundle ? (
              <Empty label="Select an intent to inspect its runtime bundle." />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag label={labelize(bundle.intent.level)} color="#a78bfa" />
                  <Tag label={labelize(bundle.intent.status)} color={statusColor(bundle.intent.status)} />
                  <Tag label={labelize(bundle.phase ?? bundle.intent.phase)} color="#60a5fa" />
                  {bundle.intent.kind ? <Tag label={labelize(bundle.intent.kind)} color="#2dd4a8" /> : null}
                  <button
                    type="button"
                    onClick={() => void handleStartExecution()}
                    disabled={creatingExecution}
                    className="ml-auto rounded-lg px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      background: "rgba(99,102,241,0.14)",
                      color: "#818cf8",
                      border: "1px solid rgba(99,102,241,0.24)",
                      opacity: creatingExecution ? 0.5 : 1,
                    }}
                  >
                    {creatingExecution ? "Starting..." : "Start Execution"}
                  </button>
                </div>

                <div>
                  <div className="text-[0.64rem] font-semibold uppercase tracking-[0.18em]" style={{ color: config.accent }}>
                    {bundle.intent.id}
                  </div>
                  <h2 className="mt-1 text-[1.15rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                    {bundle.intent.title}
                  </h2>
                  <p className="mt-3 text-[0.78rem] leading-[1.65]" style={{ color: "var(--pn-text-secondary)" }}>
                    {bundle.intent.description ?? "No description recorded for this intent yet."}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <Panel title="Intent Fields">
                    <DetailRow label="Kind" value={labelize(bundle.intent.kind)} />
                    <DetailRow label="Phase" value={labelize(bundle.phase ?? bundle.intent.phase)} />
                    <DetailRow label="Project" value={bundle.intent.project_id ?? "none"} mono />
                    <DetailRow label="Parent" value={bundle.intent.parent_id ?? "root"} mono />
                    <DetailRow label="Exit" value={bundle.intent.exit_condition ?? "not set"} />
                  </Panel>

                  <Panel title="Attachment Counts">
                    <DetailRow label="Executions" value={String(bundle.links.executions.length)} />
                    <DetailRow label="Proposals" value={String(bundle.links.proposals.length)} />
                    <DetailRow label="Tasks" value={String(bundle.links.tasks.length)} />
                    <DetailRow label="Actors" value={String(bundle.links.actors.length)} />
                    <DetailRow label="Canon" value={String(bundle.links.canon.length)} />
                  </Panel>
                </div>

                {bundle.intent.scope?.length ? (
                  <Panel title="Scope">
                    <div className="flex flex-wrap gap-2">
                      {bundle.intent.scope.map((entry) => (
                        <span key={entry} className="rounded-full px-2 py-1 text-[0.62rem] font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "var(--pn-text-secondary)" }}>
                          {entry}
                        </span>
                      ))}
                    </div>
                  </Panel>
                ) : null}

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <Panel title="Linked Proposals">
                    <LinkList items={bundle.links.proposals} emptyLabel="No proposal links yet." />
                  </Panel>
                  <Panel title="Linked Executions">
                    <LinkList items={bundle.links.executions} emptyLabel="No execution links yet." />
                  </Panel>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <Panel title="Phase History">
                    {bundle.phase_transitions.length === 0 ? (
                      <SmallMuted label="No phase transitions recorded." />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {bundle.phase_transitions.map((transition) => (
                          <TimelineRow
                            key={transition.id}
                            title={`${labelize(transition.from_phase)} → ${labelize(transition.to_phase)}`}
                            detail={transition.reason}
                            meta={formatAgo(transition.transitioned_at)}
                          />
                        ))}
                      </div>
                    )}
                  </Panel>
                  <Panel title="Recent Events">
                    {bundle.recent_events.length === 0 ? (
                      <SmallMuted label="No intent events recorded." />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {bundle.recent_events.slice(0, 8).map((event) => (
                          <TimelineRow
                            key={event.id}
                            title={labelize(event.event_type)}
                            detail={`actor: ${event.actor}`}
                            meta={formatAgo(event.happened_at)}
                          />
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppWindowChrome>
  );
}

function TreeNodeButton({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  readonly node: IntentTreeNode;
  readonly depth: number;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  const active = selectedId === node.intent.id;
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(node.intent.id)}
        className="rounded-xl px-3 py-2 text-left"
        style={{
          marginLeft: depth * 14,
          background: active ? "rgba(167,139,250,0.12)" : "transparent",
          border: active ? "1px solid rgba(167,139,250,0.24)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[0.72rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
              {node.intent.title}
            </div>
            <div className="truncate text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
              {node.intent.id} · {labelize(node.intent.status)}
            </div>
          </div>
          <span className="text-[0.55rem] uppercase tracking-[0.14em]" style={{ color: statusColor(node.intent.status) }}>
            {labelize(node.intent.level)}
          </span>
        </div>
      </button>
      {node.children.map((child) => (
        <TreeNodeButton key={child.intent.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

function Panel({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[0.58rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[0.7rem]">
      <span style={{ color: "var(--pn-text-muted)" }}>{label}</span>
      <span className={mono ? "font-mono" : undefined} style={{ color: "var(--pn-text-secondary)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function TimelineRow({ title, detail, meta }: { readonly title: string; readonly detail: string; readonly meta: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="text-[0.7rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>{title}</div>
      <div className="mt-1 text-[0.66rem]" style={{ color: "var(--pn-text-secondary)" }}>{detail}</div>
      <div className="mt-1 text-[0.58rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>{meta}</div>
    </div>
  );
}

function LinkList({ items, emptyLabel }: { readonly items: readonly IntentLinkRecord[]; readonly emptyLabel: string }) {
  if (items.length === 0) return <SmallMuted label={emptyLabel} />;
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-[0.68rem] font-mono" style={{ color: "var(--pn-text-primary)" }}>{item.target_id}</div>
          <div className="mt-1 text-[0.62rem]" style={{ color: "var(--pn-text-secondary)" }}>
            {item.relation} · {item.provenance}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tag({ label, color }: { readonly label: string; readonly color: string }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em]" style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>
      {label}
    </span>
  );
}

function MetricPill({ label, value, color }: { readonly label: string; readonly value: number; readonly color: string }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-[0.6rem] font-medium" style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>
      {label}: {value}
    </span>
  );
}

function Empty({ label }: { readonly label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
      {label}
    </div>
  );
}

function SmallMuted({ label }: { readonly label: string }) {
  return <div className="text-[0.68rem]" style={{ color: "var(--pn-text-muted)" }}>{label}</div>;
}

function statusColor(status: string): string {
  if (status === "active") return "#2dd4a8";
  if (status === "implementing") return "#f59e0b";
  if (status === "complete" || status === "completed") return "#22c55e";
  if (status === "blocked") return "#ef4444";
  return "#94a3b8";
}
