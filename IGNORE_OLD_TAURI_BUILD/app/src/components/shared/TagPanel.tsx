import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface Tag {
  readonly id: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly tag: string;
  readonly actor_id: string;
  readonly namespace: string;
  readonly inserted_at: string;
}

interface TagPanelProps {
  readonly entityType: string;
  readonly entityId: string;
  readonly actorSlug?: string;
}

// ── Namespace color map ────────────────────────────────────────────────────

const NAMESPACE_COLORS: Record<string, { bg: string; text: string }> = {
  priority: { bg: "rgba(226, 75, 74, 0.18)", text: "#F87171" },
  domain:   { bg: "rgba(75, 123, 229, 0.18)", text: "#6B95F0" },
  phase:    { bg: "rgba(168, 85, 247, 0.18)", text: "#C084FC" },
  status:   { bg: "rgba(34, 197, 94, 0.18)", text: "#4ADE80" },
  default:  { bg: "rgba(255, 255, 255, 0.06)", text: "var(--pn-text-secondary)" },
};

const NAMESPACE_OPTIONS = ["default", "priority", "domain", "phase", "status"] as const;

function colorFor(namespace: string): { bg: string; text: string } {
  return NAMESPACE_COLORS[namespace] ?? NAMESPACE_COLORS.default;
}

// ── Component ──────────────────────────────────────────────────────────────

export function TagPanel({ entityType, entityId, actorSlug = "trajan" }: TagPanelProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [namespace, setNamespace] = useState<string>("default");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
      });
      const res = await api.get<{ tags: Tag[] }>(`/tags?${params}`);
      setTags(res.tags);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const addTag = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await api.post<{ tag: Tag }>("/tags", {
        entity_type: entityType,
        entity_id: entityId,
        tag: trimmed,
        actor_id: actorSlug,
        namespace,
      });
      setInputValue("");
      await fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag");
    } finally {
      setSubmitting(false);
    }
  };

  const removeTag = async (tag: Tag) => {
    try {
      const params = new URLSearchParams({
        entity_type: tag.entity_type,
        entity_id: tag.entity_id,
        tag: tag.tag,
        actor_id: tag.actor_id,
      });
      await api.delete(`/tags?${params}`);
      await fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove tag");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void addTag();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Section header */}
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--pn-text-muted)",
        }}
      >
        Tags
      </div>

      {/* Tag badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "24px" }}>
        {loading && (
          <span style={{ fontSize: "11px", color: "var(--pn-text-muted)" }}>Loading...</span>
        )}
        {!loading && tags.length === 0 && (
          <span style={{ fontSize: "11px", color: "var(--pn-text-muted)" }}>No tags</span>
        )}
        {tags.map((tag) => {
          const colors = colorFor(tag.namespace);
          return (
            <span
              key={tag.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontSize: "11px",
                fontWeight: 500,
                background: colors.bg,
                color: colors.text,
                border: "1px solid rgba(255, 255, 255, 0.04)",
              }}
            >
              {tag.namespace !== "default" && (
                <span style={{ opacity: 0.5, fontSize: "10px" }}>{tag.namespace}:</span>
              )}
              {tag.tag}
              <button
                onClick={() => void removeTag(tag)}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: "0 0 0 2px",
                  fontSize: "12px",
                  opacity: 0.5,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
              >
                x
              </button>
            </span>
          );
        })}
      </div>

      {/* Add tag input row */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <select
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid var(--pn-border-default)",
            borderRadius: "6px",
            color: "var(--pn-text-secondary)",
            fontSize: "11px",
            padding: "4px 6px",
            outline: "none",
            minWidth: "80px",
          }}
        >
          {NAMESPACE_OPTIONS.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag..."
          disabled={submitting}
          style={{
            flex: 1,
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid var(--pn-border-default)",
            borderRadius: "6px",
            color: "var(--pn-text-primary)",
            fontSize: "11px",
            padding: "4px 8px",
            outline: "none",
          }}
        />
        <button
          onClick={() => void addTag()}
          disabled={submitting || !inputValue.trim()}
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid var(--pn-border-default)",
            borderRadius: "6px",
            color: "var(--pn-text-secondary)",
            fontSize: "11px",
            padding: "4px 10px",
            cursor: submitting || !inputValue.trim() ? "not-allowed" : "pointer",
            opacity: submitting || !inputValue.trim() ? 0.4 : 1,
          }}
        >
          Add
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div style={{ fontSize: "10px", color: "var(--color-pn-error)" }}>{error}</div>
      )}
    </div>
  );
}
