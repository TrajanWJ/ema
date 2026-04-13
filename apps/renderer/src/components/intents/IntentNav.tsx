import type { IntentNode } from "@/types/intents";
import { LEVEL_ICONS, STATUS_COLORS, LEVEL_LABELS } from "@/types/intents";

interface IntentNavProps {
  readonly tree: IntentNode[];
  readonly selectedSlug: string | null;
  readonly onSelect: (slug: string) => void;
}

export function IntentNav({ tree, selectedSlug, onSelect }: IntentNavProps) {
  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2 text-[0.6rem] uppercase tracking-wider font-semibold shrink-0"
        style={{
          color: "var(--pn-text-muted)",
          borderBottom: "1px solid var(--pn-border-subtle)",
        }}
      >
        Intent Tree
      </div>
      <div className="flex-1 overflow-auto py-1">
        {tree.length === 0 ? (
          <div
            className="px-3 py-4 text-center text-[0.7rem]"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            No intents loaded
          </div>
        ) : (
          tree.map((node) => (
            <IntentTreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedSlug={selectedSlug}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function IntentTreeNode({
  node,
  depth,
  selectedSlug,
  onSelect,
}: {
  readonly node: IntentNode;
  readonly depth: number;
  readonly selectedSlug: string | null;
  readonly onSelect: (slug: string) => void;
}) {
  const isSelected = node.slug === selectedSlug;
  const statusColor = STATUS_COLORS[node.status] ?? "#64748b";
  const levelIcon = LEVEL_ICONS[node.level] ?? "·";
  const hasChildren = node.children?.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(node.slug)}
        className="w-full text-left px-2 py-1 rounded transition-colors flex items-center gap-1.5"
        style={{
          paddingLeft: `${depth * 12 + 8}px`,
          background: isSelected ? "rgba(167, 139, 250, 0.12)" : "transparent",
          color: isSelected
            ? "var(--pn-text-primary)"
            : "var(--pn-text-secondary)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: statusColor }}
        />
        <span className="text-[0.6rem] shrink-0" style={{ color: "var(--pn-text-muted)" }}>
          {levelIcon}
        </span>
        <span className="text-[0.7rem] truncate">{node.title}</span>
      </button>
      {hasChildren &&
        node.children.map((child) => (
          <IntentTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedSlug={selectedSlug}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

interface IntentMetadataProps {
  readonly intent: IntentNode | null;
}

export function IntentMetadata({ intent }: IntentMetadataProps) {
  if (!intent) return null;

  const statusColor = STATUS_COLORS[intent.status] ?? "#64748b";

  return (
    <div
      className="shrink-0 px-3 py-2 space-y-1.5"
      style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
    >
      <div
        className="text-[0.6rem] uppercase tracking-wider font-semibold"
        style={{ color: "var(--pn-text-muted)" }}
      >
        Metadata
      </div>
      <MetaRow label="Level" value={LEVEL_LABELS[intent.level] ?? `L${intent.level}`} />
      <MetaRow label="Kind" value={intent.kind} />
      <div className="flex items-center justify-between">
        <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Status
        </span>
        <span
          className="text-[0.65rem] px-1.5 py-0.5 rounded-full"
          style={{
            background: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {intent.status}
        </span>
      </div>
      <MetaRow label="Priority" value={`P${intent.priority}`} />
      <MetaRow label="Phase" value={`${intent.phase}/5`} />
      {intent.completion_pct > 0 && (
        <div>
          <div className="flex justify-between mb-0.5">
            <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              Progress
            </span>
            <span className="text-[0.6rem]" style={{ color: "var(--pn-text-secondary)" }}>
              {intent.completion_pct}%
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${intent.completion_pct}%`,
                background: statusColor,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
        {label}
      </span>
      <span className="text-[0.65rem]" style={{ color: "var(--pn-text-secondary)" }}>
        {value}
      </span>
    </div>
  );
}
