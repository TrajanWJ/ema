import { useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.storyboard;

type CardStatus = "todo" | "active" | "done";

interface StoryCard {
  readonly id: string;
  readonly title: string;
  readonly notes: string;
  readonly status: CardStatus;
}

const STATUS_COLORS: Record<CardStatus, string> = {
  todo: "rgba(255,255,255,0.25)",
  active: "#6b95f0",
  done: "#2dd4a8",
};

const STATUS_BG: Record<CardStatus, string> = {
  todo: "rgba(255,255,255,0.06)",
  active: "rgba(107,149,240,0.15)",
  done: "rgba(45,212,168,0.15)",
};

let nextId = 1;

function makeId(): string {
  return `card-${Date.now()}-${nextId++}`;
}

const INITIAL_CARDS: StoryCard[] = [
  { id: makeId(), title: "Plan", notes: "Define scope and goals", status: "done" },
  { id: makeId(), title: "Build", notes: "Implement core features", status: "active" },
  { id: makeId(), title: "Ship", notes: "Deploy and announce", status: "todo" },
];

export function StoryboardApp() {
  const [cards, setCards] = useState<StoryCard[]>(INITIAL_CARDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = cards.find((c) => c.id === selectedId) ?? null;

  function addCard() {
    const card: StoryCard = {
      id: makeId(),
      title: `Step ${cards.length + 1}`,
      notes: "",
      status: "todo",
    };
    setCards((prev) => [...prev, card]);
    setSelectedId(card.id);
  }

  function updateCard(id: string, patch: Partial<Omit<StoryCard, "id">>) {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <AppWindowChrome appId="storyboard" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="glass-surface flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <span className="text-[0.75rem] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
            {cards.length} card{cards.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={addCard}
            className="px-3 py-1.5 rounded-md text-[0.75rem] font-medium transition-colors"
            style={{
              background: "rgba(139,92,246,0.2)",
              color: "#a78bfa",
              border: "1px solid rgba(139,92,246,0.25)",
            }}
          >
            + Add Card
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-6">
            <div className="flex items-stretch gap-0 min-w-max h-full">
              {cards.map((card, i) => (
                <div key={card.id} className="flex items-center">
                  {/* Card */}
                  <button
                    onClick={() => setSelectedId(card.id === selectedId ? null : card.id)}
                    className="flex flex-col w-44 rounded-lg p-3 transition-all shrink-0"
                    style={{
                      background:
                        card.id === selectedId
                          ? "rgba(139,92,246,0.15)"
                          : "rgba(255,255,255,0.04)",
                      border:
                        card.id === selectedId
                          ? "1px solid rgba(139,92,246,0.35)"
                          : "1px solid rgba(255,255,255,0.06)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    {/* Number + Status dot */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[0.65rem] font-bold rounded-full w-5 h-5 flex items-center justify-center"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: STATUS_COLORS[card.status] }}
                      />
                    </div>

                    {/* Title */}
                    <span
                      className="text-[0.8rem] font-medium text-left truncate mb-1"
                      style={{ color: "rgba(255,255,255,0.87)" }}
                    >
                      {card.title}
                    </span>

                    {/* Notes preview */}
                    <span
                      className="text-[0.7rem] text-left line-clamp-2"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {card.notes || "No notes"}
                    </span>

                    {/* Status badge */}
                    <div className="mt-2">
                      <span
                        className="text-[0.6rem] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          background: STATUS_BG[card.status],
                          color: STATUS_COLORS[card.status],
                        }}
                      >
                        {card.status}
                      </span>
                    </div>
                  </button>

                  {/* Arrow connector */}
                  {i < cards.length - 1 && (
                    <div className="flex items-center px-2">
                      <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
                        <line x1="0" y1="8" x2="24" y2="8" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                        <polyline points="22,4 28,8 22,12" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          {selected && (
            <div
              className="border-t border-white/[0.06] px-6 py-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[0.65rem] uppercase tracking-wider font-medium"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Card Detail
                </span>
                <button
                  onClick={() => removeCard(selected.id)}
                  className="text-[0.7rem] px-2 py-1 rounded transition-colors"
                  style={{
                    color: "#ef4444",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.15)",
                  }}
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-[1fr_1fr_auto] gap-4">
                {/* Title */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[0.65rem] uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    value={selected.title}
                    onChange={(e) => updateCard(selected.id, { title: e.target.value })}
                    className="rounded-md px-3 py-1.5 text-[0.8rem] outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.87)",
                    }}
                  />
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[0.65rem] uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    Notes
                  </label>
                  <input
                    type="text"
                    value={selected.notes}
                    onChange={(e) => updateCard(selected.id, { notes: e.target.value })}
                    className="rounded-md px-3 py-1.5 text-[0.8rem] outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.87)",
                    }}
                  />
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[0.65rem] uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    Status
                  </label>
                  <select
                    value={selected.status}
                    onChange={(e) => updateCard(selected.id, { status: e.target.value as CardStatus })}
                    className="rounded-md px-3 py-1.5 text-[0.8rem] outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.87)",
                    }}
                  >
                    <option value="todo">Todo</option>
                    <option value="active">Active</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
