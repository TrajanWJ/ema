import { useState, useEffect, useCallback } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AgentChat } from "./AgentChat";
import { api } from "@/lib/api";
import type { Agent } from "@/types/agents";

const TABS = [
  { value: "overview" as const, label: "Overview" },
  { value: "chat" as const, label: "Chat" },
  { value: "sessions" as const, label: "Sessions" },
  { value: "config" as const, label: "Config" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const STATUS_COLORS: Record<Agent["status"], string> = {
  active: "#22c55e",
  inactive: "var(--pn-text-tertiary)",
  error: "#ef4444",
};

const PHASE_COLORS: Record<string, string> = {
  idle: "rgba(255,255,255,0.3)",
  plan: "#60a5fa",
  execute: "#22c55e",
  review: "#f59e0b",
  retro: "#a78bfa",
};

interface Conversation {
  readonly id: string;
  readonly channel_type: string;
  readonly status: string;
  readonly external_user_id: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ActorInfo {
  readonly id: string;
  readonly slug: string;
  readonly phase: string;
  readonly phase_started_at: string | null;
  readonly capabilities: string[] | null;
  readonly config: Record<string, unknown> | null;
  readonly status: string;
}

interface AgentDetailProps {
  readonly agent: Agent;
  readonly onBack: () => void;
}

export function AgentDetail({ agent, onBack }: AgentDetailProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convoLoading, setConvoLoading] = useState(false);
  const [convoError, setConvoError] = useState<string | null>(null);
  const [actor, setActor] = useState<ActorInfo | null>(null);
  const [actorLoading, setActorLoading] = useState(false);
  const [configEdits, setConfigEdits] = useState<Record<string, string>>({});
  const [configSaving, setConfigSaving] = useState(false);

  const loadActor = useCallback(async () => {
    setActorLoading(true);
    try {
      const data = await api.get<{ actors: ActorInfo[] }>("/actors");
      const match = data.actors.find((a) => a.slug === agent.slug);
      if (match) setActor(match);
    } catch {
      // Actor info is optional, fail silently
    } finally {
      setActorLoading(false);
    }
  }, [agent.slug]);

  useEffect(() => {
    loadActor();
  }, [loadActor]);

  const loadConversations = useCallback(async () => {
    setConvoLoading(true);
    setConvoError(null);
    try {
      const data = await api.get<{ conversations: Conversation[] }>(
        `/agents/${agent.slug}/conversations`
      );
      setConversations(data.conversations);
    } catch {
      setConvoError("Failed to load conversations");
    } finally {
      setConvoLoading(false);
    }
  }, [agent.slug]);

  useEffect(() => {
    if (tab === "sessions") {
      loadConversations();
    }
  }, [tab, loadConversations]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  async function handleConfigSave() {
    if (Object.keys(configEdits).length === 0) return;
    setConfigSaving(true);
    try {
      await api.patch(`/agents/${agent.id}`, {
        settings: configEdits,
      });
      setConfigEdits({});
    } catch {
      // Config save failed silently for now
    } finally {
      setConfigSaving(false);
    }
  }

  const settings = (agent as unknown as { settings?: Record<string, string> })
    .settings ?? {};
  const mergedSettings = { ...settings, ...configEdits };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          &larr;
        </button>
        <span style={{ fontSize: "1.4rem" }}>{agent.avatar ?? "\u2B21"}</span>
        <div className="flex-1">
          <div
            className="text-[0.875rem] font-medium"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {agent.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="rounded-full"
              style={{
                width: "6px",
                height: "6px",
                background: STATUS_COLORS[agent.status],
              }}
            />
            <span
              className="text-[0.65rem]"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              {agent.status} · {agent.model} · t={agent.temperature}
            </span>
          </div>
        </div>
        {/* Actor phase badge */}
        {actor && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <span
              className="rounded-full"
              style={{
                width: "7px",
                height: "7px",
                background: PHASE_COLORS[actor.phase] ?? PHASE_COLORS.idle,
              }}
            />
            <span
              className="text-[0.6rem] uppercase tracking-wider font-medium"
              style={{
                color: PHASE_COLORS[actor.phase] ?? "var(--pn-text-tertiary)",
              }}
            >
              {actor.phase}
            </span>
          </div>
        )}
        {actorLoading && (
          <span
            className="text-[0.55rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            ...
          </span>
        )}
      </div>

      <div className="mb-3">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "overview" && (
          <OverviewTab agent={agent} actor={actor} />
        )}
        {tab === "chat" && <AgentChat agent={agent} />}
        {tab === "sessions" && (
          <SessionsTab
            conversations={conversations}
            loading={convoLoading}
            error={convoError}
            formatDate={formatDate}
            agentSlug={agent.slug}
          />
        )}
        {tab === "config" && (
          <ConfigTab
            agent={agent}
            mergedSettings={mergedSettings}
            configEdits={configEdits}
            configSaving={configSaving}
            onEditChange={(key, value) =>
              setConfigEdits((prev) => ({ ...prev, [key]: value }))
            }
            onAddKey={(key) =>
              setConfigEdits((prev) => ({ ...prev, [key]: "" }))
            }
            onSave={handleConfigSave}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Overview Tab ---------- */

function OverviewTab({
  agent,
  actor,
}: {
  readonly agent: Agent;
  readonly actor: ActorInfo | null;
}) {
  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <InfoField label="Name" value={agent.name} />
          <InfoField label="Slug" value={agent.slug} mono />
          <InfoField label="Model" value={agent.model} mono />
          <InfoField
            label="Temperature"
            value={String(agent.temperature)}
          />
          <InfoField label="Max Tokens" value={String(agent.max_tokens)} />
          <InfoField label="Status" value={agent.status} />
        </div>
        {agent.description && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span
              className="text-[0.6rem] uppercase tracking-wider"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              Description
            </span>
            <div
              className="text-[0.75rem] mt-1"
              style={{ color: "var(--pn-text-secondary)" }}
            >
              {agent.description}
            </div>
          </div>
        )}
      </div>

      {/* Tools */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          className="text-[0.6rem] uppercase tracking-wider"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Tools ({(agent.tools ?? []).length})
        </span>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(agent.tools ?? []).length > 0 ? (
            (agent.tools ?? []).map((tool) => (
              <span
                key={tool}
                className="text-[0.6rem] px-2 py-0.5 rounded-md font-mono"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--pn-text-secondary)",
                }}
              >
                {tool}
              </span>
            ))
          ) : (
            <span
              className="text-[0.65rem]"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              No tools configured
            </span>
          )}
        </div>
      </div>

      {/* Actor / Orchestration */}
      {actor && (
        <div
          className="rounded-lg p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span
            className="text-[0.6rem] uppercase tracking-wider"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            Actor / Orchestration
          </span>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <InfoField label="Actor ID" value={actor.id.slice(0, 8)} mono />
            <div>
              <span
                className="text-[0.6rem] uppercase tracking-wider"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                Phase
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="rounded-full"
                  style={{
                    width: "7px",
                    height: "7px",
                    background:
                      PHASE_COLORS[actor.phase] ?? PHASE_COLORS.idle,
                  }}
                />
                <span
                  className="text-[0.8rem] font-medium"
                  style={{
                    color:
                      PHASE_COLORS[actor.phase] ?? "var(--pn-text-primary)",
                  }}
                >
                  {actor.phase}
                </span>
              </div>
            </div>
            <InfoField label="Actor Status" value={actor.status} />
            {actor.phase_started_at && (
              <InfoField
                label="Phase Since"
                value={new Date(actor.phase_started_at).toLocaleString()}
              />
            )}
          </div>
          {actor.capabilities && actor.capabilities.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span
                className="text-[0.6rem] uppercase tracking-wider"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                Capabilities
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {actor.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[0.6rem] px-2 py-0.5 rounded-md"
                    style={{
                      background: "rgba(96,165,250,0.1)",
                      color: "#60a5fa",
                    }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust score */}
      {agent.trust_score && (
        <div
          className="rounded-lg p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span
            className="text-[0.6rem] uppercase tracking-wider"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            Trust Score
          </span>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <InfoField
              label="Score"
              value={`${agent.trust_score.score} (${agent.trust_score.label})`}
            />
            <InfoField
              label="Completion"
              value={`${(agent.trust_score.completion_rate * 100).toFixed(0)}%`}
            />
            <InfoField
              label="Avg Latency"
              value={`${agent.trust_score.avg_latency_ms}ms`}
            />
            <InfoField
              label="Errors"
              value={String(agent.trust_score.error_count)}
            />
            <InfoField
              label="Sessions"
              value={String(agent.trust_score.session_count)}
            />
            <InfoField
              label="Days Active"
              value={String(agent.trust_score.days_active)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Sessions Tab ---------- */

function SessionsTab({
  conversations,
  loading,
  error,
  formatDate,
  agentSlug,
}: {
  readonly conversations: Conversation[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly formatDate: (iso: string) => string;
  readonly agentSlug: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConvoMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  async function loadMessages(convoId: string) {
    setSelectedId(convoId);
    setMsgsLoading(true);
    try {
      const data = await api.get<{
        conversation: Conversation;
        messages: ConvoMessage[];
      }>(`/agents/${agentSlug}/conversations/${convoId}`);
      setMessages(data.messages);
    } catch {
      setMessages([]);
    } finally {
      setMsgsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Loading conversations...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="px-3 py-2 rounded-lg text-[0.7rem]"
        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
      >
        {error}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <span
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          No conversations yet
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Conversation list */}
      <div
        className="overflow-y-auto"
        style={{
          width: "35%",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => loadMessages(c.id)}
            className="w-full text-left"
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background:
                selectedId === c.id
                  ? "rgba(255,255,255,0.06)"
                  : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                flexShrink: 0,
                background:
                  c.status === "active" ? "#22c55e" : "rgba(255,255,255,0.25)",
              }}
            />
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                className="truncate"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: "var(--pn-text-primary)",
                }}
              >
                {c.channel_type} · {c.id.slice(0, 8)}
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--pn-text-muted)",
                  marginTop: "2px",
                }}
              >
                {formatDate(c.created_at)}
              </div>
            </div>
            <span
              style={{
                fontSize: "0.55rem",
                color: "var(--pn-text-muted)",
                flexShrink: 0,
                textTransform: "uppercase",
              }}
            >
              {c.status}
            </span>
          </button>
        ))}
      </div>

      {/* Message detail */}
      <div className="flex-1 overflow-y-auto p-3">
        {!selectedId && (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--pn-text-tertiary)", fontSize: "0.75rem" }}
          >
            Select a conversation to view messages
          </div>
        )}
        {selectedId && msgsLoading && (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--pn-text-tertiary)", fontSize: "0.75rem" }}
          >
            Loading...
          </div>
        )}
        {selectedId && !msgsLoading && messages.length === 0 && (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--pn-text-tertiary)", fontSize: "0.75rem" }}
          >
            No messages in this conversation
          </div>
        )}
        {selectedId &&
          !msgsLoading &&
          messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-lg p-2.5 mb-2"
              style={{
                background:
                  msg.role === "user"
                    ? "rgba(167,139,250,0.08)"
                    : "rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="text-[0.55rem] font-semibold uppercase"
                  style={{
                    color:
                      msg.role === "user"
                        ? "#a78bfa"
                        : "var(--pn-text-tertiary)",
                  }}
                >
                  {msg.role}
                </span>
                <span
                  className="text-[0.5rem]"
                  style={{ color: "var(--pn-text-muted)" }}
                >
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div
                className="text-[0.7rem] whitespace-pre-wrap"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {msg.content}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

interface ConvoMessage {
  readonly id: string;
  readonly role: string;
  readonly content: string;
  readonly created_at: string;
}

/* ---------- Config Tab ---------- */

function ConfigTab({
  agent,
  mergedSettings,
  configEdits,
  configSaving,
  onEditChange,
  onAddKey,
  onSave,
}: {
  readonly agent: Agent;
  readonly mergedSettings: Record<string, string>;
  readonly configEdits: Record<string, string>;
  readonly configSaving: boolean;
  readonly onEditChange: (key: string, value: string) => void;
  readonly onAddKey: (key: string) => void;
  readonly onSave: () => void;
}) {
  const [newKey, setNewKey] = useState("");

  function handleAddKey() {
    const trimmed = newKey.trim();
    if (!trimmed) return;
    onAddKey(trimmed);
    setNewKey("");
  }

  const settingsKeys = Object.keys(mergedSettings);

  return (
    <div className="space-y-4">
      {/* Core config (read-only) */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          className="text-[0.6rem] uppercase tracking-wider"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Core Configuration
        </span>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <InfoField label="Model" value={agent.model} mono />
          <InfoField
            label="Temperature"
            value={String(agent.temperature)}
          />
          <InfoField label="Max Tokens" value={String(agent.max_tokens)} />
          <InfoField
            label="Tools"
            value={(agent.tools ?? []).join(", ") || "none"}
            mono
          />
        </div>
      </div>

      {/* Editable settings */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[0.6rem] uppercase tracking-wider"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            Settings (key/value)
          </span>
          {Object.keys(configEdits).length > 0 && (
            <button
              onClick={onSave}
              disabled={configSaving}
              className="text-[0.6rem] px-2.5 py-1 rounded-md transition-opacity disabled:opacity-40"
              style={{ background: "#22c55e", color: "#fff" }}
            >
              {configSaving ? "Saving..." : "Save"}
            </button>
          )}
        </div>

        {settingsKeys.length > 0 ? (
          <div className="space-y-2">
            {settingsKeys.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="text-[0.65rem] font-mono shrink-0"
                  style={{
                    color: "var(--pn-text-secondary)",
                    minWidth: "100px",
                  }}
                >
                  {key}
                </span>
                <input
                  value={mergedSettings[key] ?? ""}
                  onChange={(e) => onEditChange(key, e.target.value)}
                  className="flex-1 text-[0.7rem] px-2 py-1 rounded-md outline-none font-mono"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--pn-text-primary)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <span
            className="text-[0.65rem]"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            No settings configured
          </span>
        )}

        {/* Add new key */}
        <div
          className="flex items-center gap-2 mt-3 pt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="new_key"
            className="text-[0.7rem] px-2 py-1 rounded-md outline-none font-mono"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--pn-text-primary)",
              border: "1px solid rgba(255,255,255,0.06)",
              width: "140px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddKey();
            }}
          />
          <button
            onClick={handleAddKey}
            disabled={!newKey.trim()}
            className="text-[0.6rem] px-2 py-1 rounded-md transition-opacity disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--pn-text-secondary)" }}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared ---------- */

function InfoField({
  label,
  value,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div>
      <span
        className="text-[0.6rem] uppercase tracking-wider"
        style={{ color: "var(--pn-text-tertiary)" }}
      >
        {label}
      </span>
      <div
        className={`text-[0.8rem] mt-0.5 ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--pn-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
