import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TagPanel } from "./TagPanel";

// ── Types ──────────────────────────────────────────────────────────────────

interface EntityDataRow {
  readonly entity_type: string;
  readonly entity_id: string;
  readonly actor_id: string;
  readonly key: string;
  readonly value: string;
  readonly inserted_at: string;
  readonly updated_at: string;
}

interface WorkContainerPanelProps {
  readonly entityType: string;
  readonly entityId: string;
  readonly actorSlug?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function WorkContainerPanel({
  entityType,
  entityId,
  actorSlug = "trajan",
}: WorkContainerPanelProps) {
  const [rows, setRows] = useState<EntityDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // New key/value state
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        actor_id: actorSlug,
        entity_type: entityType,
        entity_id: entityId,
      });
      const res = await api.get<{ entity_data: EntityDataRow[] }>(
        `/entity-data?${params}`,
      );
      setRows(res.entity_data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [actorSlug, entityType, entityId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Inline edit ────────────────────────────────────────────────────────

  const startEdit = (row: EntityDataRow) => {
    setEditingKey(row.key);
    setEditValue(row.value);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const saveEdit = async (key: string) => {
    try {
      await api.post("/entity-data", {
        actor_id: actorSlug,
        entity_type: entityType,
        entity_id: entityId,
        key,
        value: editValue,
      });
      setEditingKey(null);
      setEditValue("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const deleteRow = async (row: EntityDataRow) => {
    try {
      const params = new URLSearchParams({
        actor_id: row.actor_id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        key: row.key,
      });
      await api.delete(`/entity-data?${params}`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // ── Add new row ────────────────────────────────────────────────────────

  const addRow = async () => {
    const trimmedKey = newKey.trim();
    const trimmedValue = newValue.trim();
    if (!trimmedKey || !trimmedValue || submitting) return;

    setSubmitting(true);
    try {
      await api.post("/entity-data", {
        actor_id: actorSlug,
        entity_type: entityType,
        entity_id: entityId,
        key: trimmedKey,
        value: trimmedValue,
      });
      setNewKey("");
      setNewValue("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add data");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void addRow();
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid var(--pn-border-default)",
    borderRadius: "6px",
    color: "var(--pn-text-primary)",
    fontSize: "11px",
    padding: "4px 8px",
    outline: "none",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "12px",
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: "10px",
        border: "1px solid var(--pn-border-subtle)",
      }}
    >
      {/* Tags section */}
      <TagPanel entityType={entityType} entityId={entityId} actorSlug={actorSlug} />

      {/* Divider */}
      <div style={{ height: "1px", background: "var(--pn-border-subtle)" }} />

      {/* Entity data section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--pn-text-muted)",
          }}
        >
          Data
        </div>

        {loading && (
          <span style={{ fontSize: "11px", color: "var(--pn-text-muted)" }}>Loading...</span>
        )}

        {!loading && rows.length === 0 && (
          <span style={{ fontSize: "11px", color: "var(--pn-text-muted)" }}>No data</span>
        )}

        {/* Data rows */}
        {rows.map((row) => (
          <div
            key={`${row.actor_id}:${row.key}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 8px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.03)",
            }}
          >
            {/* Key label */}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--pn-text-secondary)",
                minWidth: "80px",
                flexShrink: 0,
              }}
            >
              {row.key}
            </span>

            {/* Value — inline edit or display */}
            {editingKey === row.key ? (
              <div style={{ display: "flex", flex: 1, gap: "4px", alignItems: "center" }}>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveEdit(row.key);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  autoFocus
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => void saveEdit(row.key)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-pn-success)",
                    fontSize: "11px",
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--pn-text-muted)",
                    fontSize: "11px",
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <span
                onClick={() => startEdit(row)}
                style={{
                  flex: 1,
                  fontSize: "12px",
                  color: "var(--pn-text-primary)",
                  cursor: "pointer",
                  padding: "2px 4px",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {row.value}
              </span>
            )}

            {/* Actor attribution */}
            {row.actor_id !== actorSlug && (
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--pn-text-muted)",
                  fontStyle: "italic",
                  flexShrink: 0,
                }}
              >
                {row.actor_id}
              </span>
            )}

            {/* Delete button */}
            {editingKey !== row.key && (
              <button
                onClick={() => void deleteRow(row)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--pn-text-muted)",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: "0 2px",
                  opacity: 0.4,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.color = "var(--color-pn-error)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "0.4";
                  e.currentTarget.style.color = "var(--pn-text-muted)";
                }}
              >
                x
              </button>
            )}
          </div>
        ))}

        {/* Add new key/value */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="Key"
            disabled={submitting}
            style={{ ...inputStyle, width: "90px", flexShrink: 0 }}
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="Value"
            disabled={submitting}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => void addRow()}
            disabled={submitting || !newKey.trim() || !newValue.trim()}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid var(--pn-border-default)",
              borderRadius: "6px",
              color: "var(--pn-text-secondary)",
              fontSize: "11px",
              padding: "4px 10px",
              cursor:
                submitting || !newKey.trim() || !newValue.trim()
                  ? "not-allowed"
                  : "pointer",
              opacity: submitting || !newKey.trim() || !newValue.trim() ? 0.4 : 1,
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
    </div>
  );
}
