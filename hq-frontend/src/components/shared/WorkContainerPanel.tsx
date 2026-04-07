import { useEffect, useState } from "react";
import { TagPanel } from "./TagPanel";
import * as hq from "../../api/hq";

interface WorkContainerPanelProps {
  entityType: string;
  entityId: string;
  actorId?: string;
}

interface EntityDataItem {
  key: string;
  value: string;
  actor_id: string;
}

export function WorkContainerPanel({ entityType, entityId, actorId }: WorkContainerPanelProps) {
  const [entityData, setEntityData] = useState<EntityDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    setLoading(true);
    hq.getEntityData({ entity_type: entityType, entity_id: entityId })
      .then((data) => setEntityData(data.entity_data as EntityDataItem[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  async function handleAddData() {
    if (!newKey.trim() || !newValue.trim()) return;
    await hq.setEntityData({
      entity_type: entityType,
      entity_id: entityId,
      actor_id: actorId || "human",
      key: newKey.trim(),
      value: newValue.trim(),
    });
    setNewKey("");
    setNewValue("");
    // Reload
    const data = await hq.getEntityData({ entity_type: entityType, entity_id: entityId });
    setEntityData(data.entity_data as EntityDataItem[]);
  }

  return (
    <div className="card-list">
      {/* Tags */}
      <div className="glass panel">
        <strong style={{ fontSize: 11, marginBottom: 8, display: "block" }}>Tags</strong>
        <TagPanel entityType={entityType} entityId={entityId} actorId={actorId} />
      </div>

      {/* Entity Data */}
      <div className="glass panel">
        <strong style={{ fontSize: 11, marginBottom: 8, display: "block" }}>Entity Data</strong>
        {loading ? (
          <div className="muted" style={{ fontSize: 11 }}>Loading...</div>
        ) : entityData.length === 0 ? (
          <div className="muted" style={{ fontSize: 11 }}>No entity data</div>
        ) : (
          <div style={{ fontSize: 11 }}>
            {entityData.map((item, i) => (
              <div key={i} className="row-between" style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <div className="row">
                  <span className="muted">{item.key}</span>
                  <span>{item.value}</span>
                </div>
                <span className="dim" style={{ fontSize: 9 }}>{item.actor_id}</span>
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ marginTop: 8, gap: 4 }}>
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key"
            style={{ fontSize: 10, padding: "4px 6px", flex: 1 }}
          />
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value"
            style={{ fontSize: 10, padding: "4px 6px", flex: 1 }}
          />
          <button onClick={handleAddData} style={{ fontSize: 10, padding: "4px 8px" }}>+</button>
        </div>
      </div>
    </div>
  );
}
