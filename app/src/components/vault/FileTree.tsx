import { useState, useMemo } from "react";
import type { VaultNote } from "@/types/vault";

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  note: VaultNote | null;
}

function buildTree(notes: readonly VaultNote[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [], note: null };

  for (const note of notes) {
    const parts = note.file_path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: [],
          note: i === parts.length - 1 ? note : null,
        };
        current.children.push(child);
      }
      if (i === parts.length - 1) {
        child.note = note;
      }
      current = child;
    }
  }

  return root.children;
}

interface TreeItemProps {
  readonly node: TreeNode;
  readonly depth: number;
  readonly onSelect: (path: string) => void;
}

function TreeItem({ node, depth, onSelect }: TreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = node.children.length > 0 && !node.note;

  return (
    <div>
      <button
        onClick={() => {
          if (isFolder) {
            setExpanded(!expanded);
          } else if (node.note) {
            onSelect(node.note.file_path);
          }
        }}
        className="flex items-center gap-1.5 w-full text-left py-0.5 hover:bg-white/5 rounded px-1 transition-colors"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isFolder && (
          <span
            className="text-[0.5rem]"
            style={{
              color: "var(--pn-text-tertiary)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            &#9654;
          </span>
        )}
        <span
          className="text-[0.7rem] truncate"
          style={{
            color: isFolder ? "var(--pn-text-secondary)" : "var(--pn-text-primary)",
            fontWeight: isFolder ? 500 : 400,
          }}
        >
          {node.name}
        </span>
      </button>
      {expanded && node.children.map((child) => (
        <TreeItem key={child.path} node={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface FileTreeProps {
  readonly notes: readonly VaultNote[];
  readonly onSelect: (path: string) => void;
}

export function FileTree({ notes, onSelect }: FileTreeProps) {
  const tree = useMemo(() => buildTree(notes), [notes]);

  if (tree.length === 0) {
    return (
      <div className="p-3">
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          No files in vault
        </span>
      </div>
    );
  }

  return (
    <div className="py-1">
      {tree.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} onSelect={onSelect} />
      ))}
    </div>
  );
}
