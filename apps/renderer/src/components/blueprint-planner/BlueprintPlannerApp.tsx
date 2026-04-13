import { useEffect, useMemo, useState } from "react";

import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["blueprint-planner"];

export interface GACOption {
  readonly label: string;
  readonly text: string;
  readonly implications: string;
}

export interface GACCard {
  readonly id: string;
  readonly type: "gac_card";
  readonly layer: "intents";
  readonly title: string;
  readonly status: "pending" | "answered" | "deferred" | "promoted";
  readonly created: string;
  readonly updated: string;
  readonly answered_at?: string;
  readonly answered_by?: string;
  readonly author: string;
  readonly category: "gap" | "assumption" | "clarification";
  readonly priority: "critical" | "high" | "medium" | "low";
  readonly question: string;
  readonly options: readonly GACOption[];
  readonly answer?: {
    readonly selected: string | null;
    readonly freeform?: string;
    readonly answered_by: string;
    readonly answered_at: string;
  };
  readonly result_action?: {
    readonly type: string;
    readonly target?: string;
  };
  readonly connections: readonly { readonly target: string; readonly relation: string }[];
  readonly context?: {
    readonly related_nodes?: readonly string[];
    readonly section?: string;
  };
  readonly tags: readonly string[];
}

type TabId = "pending" | "answered" | "deferred" | "promoted";

const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: "pending", label: "Open" },
  { id: "answered", label: "Answered" },
  { id: "deferred", label: "Deferred" },
  { id: "promoted", label: "Promoted" },
] as const;

const CATEGORY_COLORS: Record<GACCard["category"], string> = {
  gap: "#f97316",
  assumption: "#a78bfa",
  clarification: "#2dd4a8",
};

const PRIORITY_COLORS: Record<GACCard["priority"], string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#94a3b8",
};

function formatAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function BlueprintPlannerApp() {
  const [cards, setCards] = useState<readonly GACCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function loadCards() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ cards: GACCard[] }>("/blueprint/gac");
      setCards(data.cards);
      setSelectedId((current) => current ?? data.cards[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "blueprint_load_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCards();
  }, []);

  const filtered = useMemo(() => {
    if (tab === "pending") return cards.filter((card) => card.status === "pending");
    return cards.filter((card) => card.status === tab);
  }, [cards, tab]);

  const selected = filtered.find((card) => card.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selected && filtered[0]) setSelectedId(filtered[0].id);
  }, [filtered, selected]);

  const stats = {
    pending: cards.filter((card) => card.status === "pending").length,
    answered: cards.filter((card) => card.status === "answered").length,
    deferred: cards.filter((card) => card.status === "deferred").length,
    promoted: cards.filter((card) => card.status === "promoted").length,
  };

  async function handleAnswer(cardId: string, option: string | null) {
    setSubmitting(cardId);
    setError(null);
    try {
      await api.post(`/blueprint/gac/${cardId}/answer`, {
        selected: option,
        answered_by: "renderer.blueprint-planner",
      });
      await loadCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "answer_failed");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDefer(cardId: string) {
    setSubmitting(cardId);
    setError(null);
    try {
      await api.post(`/blueprint/gac/${cardId}/defer`, {
        actor: "renderer.blueprint-planner",
        reason: "Deferred from renderer backlog review",
      });
      await loadCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "defer_failed");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <AppWindowChrome
      appId="blueprint-planner"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={selected ? selected.id : "Planner"}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(45,212,168,0.12), rgba(107,149,240,0.06))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]" style={{ color: config.accent }}>
            Blueprint Queue
          </div>
          <div className="mt-1 text-[1rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            Local GAC review over the live backend
          </div>
          <p className="mt-2 max-w-3xl text-[0.75rem] leading-[1.6]" style={{ color: "var(--pn-text-secondary)" }}>
            This app now reads and answers the active `/api/blueprint/gac` queue directly. It is no longer dependent on the old external blueprint server on port `7777`.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatPill label="Open" value={stats.pending} color="#2dd4a8" />
            <StatPill label="Answered" value={stats.answered} color="#60a5fa" />
            <StatPill label="Deferred" value={stats.deferred} color="#f59e0b" />
            <StatPill label="Promoted" value={stats.promoted} color="#a78bfa" />
          </div>
        </div>

        {error ? (
          <div className="rounded-xl px-3 py-2 text-[0.72rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--pn-border-subtle)" }}>
          {TABS.map((item) => {
            const active = item.id === tab;
            const count = stats[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className="rounded-full px-3 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em]"
                style={{
                  background: active ? "rgba(45,212,168,0.14)" : "rgba(255,255,255,0.04)",
                  color: active ? config.accent : "var(--pn-text-secondary)",
                  border: active ? "1px solid rgba(45,212,168,0.28)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {item.label} {count > 0 ? `· ${count}` : ""}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void loadCards()}
            className="ml-auto rounded-lg px-3 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em]"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--pn-text-secondary)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Refresh
          </button>
        </div>

        <div className="flex min-h-0 flex-1 gap-3">
          <div
            className="w-[24rem] shrink-0 overflow-y-auto rounded-2xl p-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {loading ? (
              <EmptyState label="Loading blueprint cards..." />
            ) : filtered.length === 0 ? (
              <EmptyState label={`No ${tab} cards.`} />
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedId(card.id)}
                    className="rounded-xl p-3 text-left transition-colors"
                    style={{
                      background: selected?.id === card.id ? "rgba(45,212,168,0.10)" : "rgba(255,255,255,0.02)",
                      border: selected?.id === card.id ? "1px solid rgba(45,212,168,0.24)" : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[0.62rem] font-mono" style={{ color: config.accent }}>{card.id}</span>
                      <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em]" style={{ color: PRIORITY_COLORS[card.priority] }}>
                        {card.priority}
                      </span>
                    </div>
                    <div className="mt-1 text-[0.78rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                      {card.title}
                    </div>
                    <div className="mt-2 line-clamp-2 text-[0.68rem] leading-[1.5]" style={{ color: "var(--pn-text-secondary)" }}>
                      {card.question}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[0.58rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                      <span>{card.category}</span>
                      <span>{formatAgo(card.updated)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {!selected ? (
              <EmptyState label="Select a GAC card to inspect and answer." />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge label={selected.category} color={CATEGORY_COLORS[selected.category]} />
                  <Badge label={selected.priority} color={PRIORITY_COLORS[selected.priority]} />
                  <Badge label={selected.status} color={statusColor(selected.status)} />
                  <span className="ml-auto text-[0.62rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                    Updated {formatAgo(selected.updated)}
                  </span>
                </div>

                <div>
                  <div className="text-[0.64rem] font-semibold uppercase tracking-[0.18em]" style={{ color: config.accent }}>
                    {selected.id}
                  </div>
                  <h2 className="mt-1 text-[1.15rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                    {selected.title}
                  </h2>
                  <p className="mt-3 text-[0.78rem] leading-[1.65]" style={{ color: "var(--pn-text-secondary)" }}>
                    {selected.question}
                  </p>
                </div>

                {selected.context ? (
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-[0.58rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                      Context
                    </div>
                    {selected.context.section ? (
                      <div className="mt-2 text-[0.72rem]" style={{ color: "var(--pn-text-secondary)" }}>
                        Section: {selected.context.section}
                      </div>
                    ) : null}
                    {selected.context.related_nodes?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selected.context.related_nodes.map((node) => (
                          <span key={node} className="rounded-full px-2 py-1 text-[0.6rem] font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "var(--pn-text-secondary)" }}>
                            {node}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <div className="text-[0.58rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                    Options
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {selected.options.map((option) => (
                      <OptionCard
                        key={option.label}
                        option={option}
                        disabled={selected.status !== "pending" || submitting === selected.id}
                        onChoose={() => void handleAnswer(selected.id, option.label)}
                      />
                    ))}
                  </div>
                </div>

                {selected.answer ? (
                  <div className="rounded-xl p-3" style={{ background: "rgba(45,212,168,0.08)", border: "1px solid rgba(45,212,168,0.18)" }}>
                    <div className="text-[0.58rem] font-semibold uppercase tracking-[0.18em]" style={{ color: config.accent }}>
                      Recorded Answer
                    </div>
                    <div className="mt-2 text-[0.76rem]" style={{ color: "var(--pn-text-primary)" }}>
                      Selected: {selected.answer.selected ?? "freeform"}
                    </div>
                    <div className="mt-1 text-[0.68rem]" style={{ color: "var(--pn-text-secondary)" }}>
                      by {selected.answer.answered_by} · {formatAgo(selected.answer.answered_at)}
                    </div>
                  </div>
                ) : null}

                {selected.status === "pending" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDefer(selected.id)}
                      disabled={submitting === selected.id}
                      className="rounded-lg px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em]"
                      style={{
                        background: "rgba(245,158,11,0.12)",
                        color: "#fbbf24",
                        border: "1px solid rgba(245,158,11,0.28)",
                        opacity: submitting === selected.id ? 0.5 : 1,
                      }}
                    >
                      Defer
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAnswer(selected.id, null)}
                      disabled={submitting === selected.id}
                      className="rounded-lg px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em]"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--pn-text-secondary)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        opacity: submitting === selected.id ? 0.5 : 1,
                      }}
                    >
                      Mark Answered Without Option
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppWindowChrome>
  );
}

function OptionCard({
  option,
  disabled,
  onChoose,
}: {
  readonly option: GACOption;
  readonly disabled: boolean;
  readonly onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      className="rounded-xl p-3 text-left"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-md px-2 py-1 text-[0.62rem] font-mono" style={{ background: "rgba(45,212,168,0.12)", color: "#2dd4a8" }}>
          {option.label}
        </span>
      </div>
      <div className="mt-2 text-[0.75rem] leading-[1.55]" style={{ color: "var(--pn-text-primary)" }}>
        {option.text}
      </div>
      {option.implications ? (
        <div className="mt-2 text-[0.66rem] leading-[1.55]" style={{ color: "var(--pn-text-secondary)" }}>
          {option.implications}
        </div>
      ) : null}
    </button>
  );
}

function statusColor(status: GACCard["status"]): string {
  if (status === "pending") return "#2dd4a8";
  if (status === "answered") return "#60a5fa";
  if (status === "deferred") return "#f59e0b";
  return "#a78bfa";
}

function Badge({ label, color }: { readonly label: string; readonly color: string }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em]" style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>
      {label}
    </span>
  );
}

function StatPill({ label, value, color }: { readonly label: string; readonly value: number; readonly color: string }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-[0.6rem] font-medium" style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>
      {label}: {value}
    </span>
  );
}

function EmptyState({ label }: { readonly label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
      {label}
    </div>
  );
}
