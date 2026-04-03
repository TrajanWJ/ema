import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { useIntentStore, type IntentNode } from "@/stores/intent-store";
import { useProjectsStore } from "@/stores/projects-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["intent-map"];

interface TreeNode {
  readonly id: string;
  readonly title: string;
  readonly level: number;
  readonly status: string;
  readonly children?: readonly TreeNode[];
}

const LEVEL_LABELS = ["Product", "Flow", "Action", "System", "Implementation"];
const LEVEL_COLORS = ["#a78bfa", "#6b95f0", "#5eead4", "#f59e0b", "#ef4444"];
const STATUS_COLORS: Record<string, string> = { planned: "#6b7280", partial: "#eab308", complete: "#22C55E" };

export function IntentMapApp() {
  const [ready, setReady] = useState(false);
  const projects = useProjectsStore((s) => s.projects);
  const tree = useIntentStore((s) => s.tree);
  const selectedProject = useIntentStore((s) => s.selectedProject);
  const selectedNode = useIntentStore((s) => s.selectedNode);
  const selectProject = useIntentStore((s) => s.selectProject);
  const selectNode = useIntentStore((s) => s.selectNode);
  const createNode = useIntentStore((s) => s.createNode);
  const updateNode = useIntentStore((s) => s.updateNode);
  const deleteNode = useIntentStore((s) => s.deleteNode);
  const zoomLevel = useIntentStore((s) => s.zoomLevel);
  const setZoomLevel = useIntentStore((s) => s.setZoomLevel);
  const exportMarkdown = useIntentStore((s) => s.exportMarkdown);
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addParent, setAddParent] = useState<string | null>(null);
  const [addLevel, setAddLevel] = useState(0);

  useEffect(() => {
    async function init() {
      await useProjectsStore.getState().loadViaRest().catch(() => {});
      await useIntentStore.getState().loadViaRest().catch(() => {});
      setReady(true);
      useIntentStore.getState().connect().catch(() => {});
    }
    init();
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="intent-map" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  function handleAddNode() {
    if (!addTitle.trim() || !selectedProject) return;
    createNode({
      title: addTitle,
      level: addLevel,
      parent_id: addParent,
      project_id: selectedProject,
    });
    setAddTitle("");
    setShowAdd(false);
  }

  async function handleExport() {
    if (!selectedProject) return;
    const md = await exportMarkdown(selectedProject);
    navigator.clipboard.writeText(md);
  }

  return (
    <AppWindowChrome appId="intent-map" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          {/* Project selector */}
          <NativeSelect
            value={selectedProject ?? ""}
            onChange={(e) => selectProject(e.target.value || null)}
            uiSize="sm"
            wrapperClassName="w-[14rem]"
          >
            <option value="">Select Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </NativeSelect>

          {/* Zoom level */}
          <div className="flex items-center gap-1">
            {LEVEL_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => setZoomLevel(i)}
                className="px-2 py-1 rounded text-[0.55rem] font-mono transition-all"
                style={{
                  background: i <= zoomLevel ? `${LEVEL_COLORS[i]}15` : "transparent",
                  color: i <= zoomLevel ? LEVEL_COLORS[i] : "rgba(255,255,255,0.2)",
                  border: i <= zoomLevel ? `1px solid ${LEVEL_COLORS[i]}30` : "1px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 rounded-md text-[0.65rem] font-mono"
              style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}
            >
              + Add Node
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-md text-[0.65rem] font-mono"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--pn-text-secondary)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Export MD
            </button>
          </div>
        </div>

        {/* Tree + detail */}
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Tree */}
          <div className="flex-1 overflow-auto">
            {!selectedProject ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>Select a project</span>
              </div>
            ) : tree.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
                  No intent nodes. Add one to start mapping.
                </span>
              </div>
            ) : (
              <TreeView
                nodes={tree}
                maxLevel={zoomLevel}
                selectedId={selectedNode?.id ?? null}
                onSelect={(node) => selectNode(node as IntentNode)}
                onAddChild={(parentId, level) => { setAddParent(parentId); setAddLevel(level + 1); setShowAdd(true); }}
              />
            )}
          </div>

          {/* Detail panel */}
          {selectedNode && (
            <div
              className="overflow-auto rounded-lg p-3"
              style={{ width: "300px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <NodeDetail
                node={selectedNode}
                onUpdate={(attrs) => updateNode(selectedNode.id, attrs)}
                onDelete={() => deleteNode(selectedNode.id)}
              />
            </div>
          )}
        </div>

        {/* Add node modal */}
        {showAdd && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowAdd(false)}>
            <div className="rounded-lg p-4 w-80" style={{ background: "rgba(14,16,23,0.95)", border: "1px solid rgba(167,139,250,0.2)" }} onClick={(e) => e.stopPropagation()}>
              <div className="text-[0.8rem] font-medium mb-3" style={{ color: "rgba(255,255,255,0.87)" }}>Add Intent Node</div>
              <input
                autoFocus
                placeholder="Title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNode()}
                className="w-full px-3 py-2 rounded-md text-[0.8rem] mb-2"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.87)", outline: "none" }}
              />
              <NativeSelect
                value={addLevel}
                onChange={(e) => setAddLevel(Number(e.target.value))}
                uiSize="md"
                wrapperClassName="mb-3"
              >
                {LEVEL_LABELS.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </NativeSelect>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-md text-[0.7rem]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--pn-text-secondary)" }}>Cancel</button>
                <button onClick={handleAddNode} className="flex-1 py-2 rounded-md text-[0.7rem]" style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa" }}>Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}

function TreeView({
  nodes, maxLevel, selectedId, onSelect, onAddChild, depth = 0,
}: {
  readonly nodes: readonly TreeNode[];
  readonly maxLevel: number;
  readonly selectedId: string | null;
  readonly onSelect: (node: TreeNode) => void;
  readonly onAddChild: (parentId: string, level: number) => void;
  readonly depth?: number;
}) {
  return (
    <div style={{ paddingLeft: depth > 0 ? "16px" : "0" }}>
      {nodes.map((node) => {
        if (node.level > maxLevel) return null;
        const color = LEVEL_COLORS[node.level] ?? "#6b7280";
        const statusColor = STATUS_COLORS[node.status] ?? "#6b7280";

        return (
          <div key={node.id}>
            <button
              onClick={() => onSelect(node)}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md mb-0.5 transition-all hover:bg-[rgba(255,255,255,0.04)]"
              style={{
                background: selectedId === node.id ? "rgba(167,139,250,0.1)" : "transparent",
                borderLeft: `2px solid ${color}`,
              }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
              <span className="text-[0.55rem] font-mono uppercase shrink-0" style={{ color, opacity: 0.7 }}>
                {LEVEL_LABELS[node.level]?.slice(0, 4)}
              </span>
              <span className="text-[0.72rem] truncate" style={{ color: "rgba(255,255,255,0.87)" }}>
                {node.title}
              </span>
              {node.level < 4 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddChild(node.id, node.level); }}
                  className="ml-auto text-[0.6rem] opacity-30 hover:opacity-70 shrink-0"
                >
                  +
                </button>
              )}
            </button>
            {node.children && node.children.length > 0 && (
              <TreeView
                nodes={node.children as typeof nodes}
                maxLevel={maxLevel}
                selectedId={selectedId}
                onSelect={onSelect}
                onAddChild={onAddChild}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NodeDetail({
  node, onUpdate, onDelete,
}: {
  readonly node: { readonly id: string; readonly title: string; readonly description: string | null; readonly level: number; readonly level_name: string; readonly status: string; readonly linked_task_ids: readonly string[]; readonly linked_wiki_path: string | null };
  readonly onUpdate: (attrs: Record<string, unknown>) => void;
  readonly onDelete: () => void;
}) {
  const color = LEVEL_COLORS[node.level] ?? "#6b7280";

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>{node.title}</div>
      <div className="flex items-center gap-2">
        <span className="text-[0.55rem] font-mono uppercase px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>
          {node.level_name}
        </span>
        <span
          className="text-[0.55rem] font-mono uppercase px-1.5 py-0.5 rounded"
          style={{ background: `${STATUS_COLORS[node.status]}15`, color: STATUS_COLORS[node.status] }}
        >
          {node.status}
        </span>
      </div>
      {node.description && (
        <div className="text-[0.7rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
          {node.description}
        </div>
      )}
      {/* Status buttons */}
      <div className="flex gap-1">
        {(["planned", "partial", "complete"] as const).map((s) => (
          <button
            key={s}
            onClick={() => onUpdate({ status: s })}
            className="flex-1 py-1.5 rounded text-[0.6rem] font-mono transition-all"
            style={{
              background: node.status === s ? `${STATUS_COLORS[s]}20` : "rgba(255,255,255,0.04)",
              color: node.status === s ? STATUS_COLORS[s] : "var(--pn-text-muted)",
              border: node.status === s ? `1px solid ${STATUS_COLORS[s]}30` : "1px solid transparent",
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {node.linked_wiki_path && (
        <div className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
          Wiki: {node.linked_wiki_path}
        </div>
      )}
      {node.linked_task_ids.length > 0 && (
        <div className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
          Tasks: {node.linked_task_ids.length} linked
        </div>
      )}
      <button
        onClick={onDelete}
        className="mt-2 py-1.5 rounded text-[0.65rem] font-mono transition-all hover:brightness-110"
        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        Delete Node
      </button>
    </div>
  );
}
