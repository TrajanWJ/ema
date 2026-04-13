import { useState } from "react";
import { useMetaMindStore } from "@/stores/metamind-store";
import type { SavedPrompt, PromptCategory } from "@/types/metamind";

const CATEGORIES: { value: PromptCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "system", label: "System" },
  { value: "review", label: "Review" },
  { value: "metaprompt", label: "Meta" },
  { value: "template", label: "Template" },
  { value: "technique", label: "Technique" },
  { value: "research", label: "Research" },
];

function EffectivenessBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "#22c55e" : score >= 0.4 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 rounded-full flex-1"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[0.6rem] w-7 text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function PromptCard({
  prompt,
  onSelect,
}: {
  prompt: SavedPrompt;
  onSelect: (p: SavedPrompt) => void;
}) {
  return (
    <button
      type="button"
      className="w-full text-left glass-surface rounded-lg p-3 hover:border-white/10 transition-colors cursor-pointer"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      onClick={() => onSelect(prompt)}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span
          className="text-[0.8rem] font-medium line-clamp-1"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {prompt.name}
        </span>
        <span
          className="text-[0.6rem] px-1.5 py-0.5 rounded shrink-0"
          style={{
            background: "rgba(167,139,250,0.12)",
            color: "#a78bfa",
          }}
        >
          v{prompt.version}
        </span>
      </div>

      <div
        className="text-[0.7rem] line-clamp-2 mb-2"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        {prompt.body.slice(0, 150)}
        {prompt.body.length > 150 && "..."}
      </div>

      <EffectivenessBar score={prompt.effectiveness_score} />

      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1 flex-wrap">
          {prompt.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[0.55rem] px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--pn-text-tertiary)",
              }}
            >
              {tag}
            </span>
          ))}
          {prompt.tags.length > 3 && (
            <span className="text-[0.55rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              +{prompt.tags.length - 3}
            </span>
          )}
        </div>
        <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          {prompt.usage_count} uses
        </span>
      </div>
    </button>
  );
}

export function PromptLibrary({
  onSelectPrompt,
}: {
  onSelectPrompt: (p: SavedPrompt) => void;
}) {
  const prompts = useMetaMindStore((s) => s.prompts);
  const searchQuery = useMetaMindStore((s) => s.searchQuery);
  const setSearchQuery = useMetaMindStore((s) => s.setSearchQuery);
  const searchPrompts = useMetaMindStore((s) => s.searchPrompts);
  const categoryFilter = useMetaMindStore((s) => s.categoryFilter);
  const setCategoryFilter = useMetaMindStore((s) => s.setCategoryFilter);
  const [sortBy, setSortBy] = useState<"score" | "usage" | "recent">("score");

  const filtered = prompts.filter((p) => {
    if (categoryFilter && categoryFilter !== "all" && p.category !== categoryFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "score") return b.effectiveness_score - a.effectiveness_score;
    if (sortBy === "usage") return b.usage_count - a.usage_count;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchPrompts(searchQuery)}
          placeholder="Search prompts..."
          className="w-full px-3 py-2 rounded-lg text-[0.8rem] outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--pn-text-primary)",
          }}
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            className="px-2 py-1 rounded text-[0.65rem] transition-colors"
            style={{
              background:
                (categoryFilter ?? "all") === cat.value
                  ? "rgba(107,149,240,0.15)"
                  : "rgba(255,255,255,0.04)",
              color:
                (categoryFilter ?? "all") === cat.value
                  ? "#6b95f0"
                  : "var(--pn-text-secondary)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            onClick={() => setCategoryFilter(cat.value === "all" ? null : cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Sort:
        </span>
        {(["score", "usage", "recent"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className="text-[0.65rem] capitalize"
            style={{ color: sortBy === s ? "#2dd4a8" : "var(--pn-text-tertiary)" }}
            onClick={() => setSortBy(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-2xl opacity-30">{"\u{1F4DA}"}</span>
            <span className="text-[0.8rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              No prompts found
            </span>
          </div>
        ) : (
          sorted.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} onSelect={onSelectPrompt} />
          ))
        )}
      </div>
    </div>
  );
}
