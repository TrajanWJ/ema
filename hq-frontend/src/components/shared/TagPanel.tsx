import { useEffect, useState } from "react";
import { useTagStore, type Tag } from "../../store/tagStore";

interface TagPanelProps {
  entityType: string;
  entityId: string;
  actorId?: string;
}

const NAMESPACE_COLORS: Record<string, string> = {
  priority: "var(--red)",
  domain: "var(--accent)",
  phase: "var(--purple)",
  status: "var(--green)",
  default: "var(--muted)",
};

export function TagPanel({ entityType, entityId, actorId }: TagPanelProps) {
  const { loadTags, addTag, removeTag, getTagsForEntity } = useTagStore();
  const [input, setInput] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTags({ entity_type: entityType, entity_id: entityId });
  }, [entityType, entityId, loadTags]);

  const tags = getTagsForEntity(entityType, entityId);

  async function handleAdd() {
    if (!input.trim()) return;
    setAdding(true);
    try {
      await addTag({
        entity_type: entityType,
        entity_id: entityId,
        tag: input.trim(),
        actor_id: actorId,
        namespace,
      });
      setInput("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {tags.length === 0 && (
          <span className="muted" style={{ fontSize: 10 }}>No tags</span>
        )}
        {tags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            onRemove={() =>
              removeTag({
                entity_type: entityType,
                entity_id: entityId,
                tag: tag.tag,
                actor_id: tag.actor_id,
              })
            }
          />
        ))}
      </div>
      <div className="row" style={{ gap: 4 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
          placeholder="Add tag"
          style={{ fontSize: 11, padding: "4px 8px", flex: 1 }}
        />
        <select
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
          style={{ fontSize: 10, padding: "4px 6px", width: 80 }}
        >
          {Object.keys(NAMESPACE_COLORS).map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
        <button onClick={handleAdd} disabled={adding} style={{ fontSize: 10, padding: "4px 8px" }}>
          +
        </button>
      </div>
    </div>
  );
}

function TagBadge({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  const color = NAMESPACE_COLORS[tag.namespace] || NAMESPACE_COLORS.default;
  return (
    <span
      className="badge"
      style={{
        fontSize: 10,
        color,
        background: `${color}15`,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {tag.namespace !== "default" && (
        <span style={{ opacity: 0.6 }}>{tag.namespace}:</span>
      )}
      {tag.tag}
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color,
          fontSize: 9,
          padding: 0,
          cursor: "pointer",
          opacity: 0.6,
        }}
      >
        ×
      </button>
    </span>
  );
}
