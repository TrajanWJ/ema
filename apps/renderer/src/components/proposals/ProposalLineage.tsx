import { useMemo } from "react";
import { useProposalsStore } from "@/stores/proposals-store";
import { useExecutionStore } from "@/stores/execution-store";
import type { Proposal } from "@/types/proposals";

const STATUS_COLORS: Record<string, string> = {
  queued: "#f59e0b",
  reviewing: "#a78bfa",
  approved: "#22c55e",
  redirected: "#f59e0b",
  killed: "#ef4444",
  generating: "#6b95f0",
  failed: "#ef4444",
};

interface TreeNodeData {
  proposal: Proposal;
  children: TreeNodeData[];
}

function buildTree(proposals: readonly Proposal[]): TreeNodeData[] {
  const byId = new Map<string, Proposal>();
  const childrenMap = new Map<string, Proposal[]>();

  for (const p of proposals) {
    byId.set(p.id, p);
    const parentId = p.parent_proposal_id ?? "__root__";
    const arr = childrenMap.get(parentId) ?? [];
    arr.push(p);
    childrenMap.set(parentId, arr);
  }

  function buildNode(proposal: Proposal): TreeNodeData {
    const kids = childrenMap.get(proposal.id) ?? [];
    return {
      proposal,
      children: kids.map(buildNode),
    };
  }

  // Root nodes: proposals with no parent or whose parent isn't in the set
  const roots = proposals.filter(
    (p) => !p.parent_proposal_id || !byId.has(p.parent_proposal_id),
  );

  return roots.map(buildNode);
}

function TreeNode({ node, depth }: { node: TreeNodeData; depth: number }) {
  const executions = useExecutionStore((s) => s.executions);
  const linkedExec = executions.find((e) => e.proposal_id === node.proposal.id);
  const statusColor = STATUS_COLORS[node.proposal.status] ?? "#a78bfa";

  return (
    <div style={{ marginLeft: depth > 0 ? "16px" : 0 }}>
      <div
        className="flex items-center gap-2 px-2.5 py-2 rounded-md mb-1 transition-colors hover:bg-white/[0.02]"
        style={{
          borderLeft: depth > 0 ? `2px solid ${statusColor}40` : "none",
        }}
      >
        <span
          className="shrink-0 rounded-full"
          style={{ width: "7px", height: "7px", background: statusColor }}
        />
        <span
          className="text-[0.7rem] font-medium flex-1 truncate"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {node.proposal.title}
        </span>
        <span
          className="text-[0.5rem] px-1.5 py-0.5 rounded shrink-0"
          style={{ background: `${statusColor}15`, color: statusColor }}
        >
          {node.proposal.status}
        </span>
        {linkedExec && (
          <span
            className="text-[0.5rem] px-1.5 py-0.5 rounded shrink-0"
            style={{
              background: linkedExec.status === "completed" ? "rgba(34,197,94,0.1)" : "rgba(107,149,240,0.1)",
              color: linkedExec.status === "completed" ? "#22c55e" : "#6b95f0",
            }}
          >
            exec: {linkedExec.status}
          </span>
        )}
        {node.children.length > 0 && (
          <span className="text-[0.5rem]" style={{ color: "var(--pn-text-muted)" }}>
            {node.children.length} child{node.children.length !== 1 ? "ren" : ""}
          </span>
        )}
      </div>
      {node.children.map((child) => (
        <TreeNode key={child.proposal.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function ProposalLineage() {
  const proposals = useProposalsStore((s) => s.proposals);

  const tree = useMemo(() => buildTree(proposals), [proposals]);

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
          No proposals yet
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[0.6rem] uppercase tracking-wider" style={{ color: "var(--pn-text-muted)" }}>
          Proposal Lineage
        </span>
        <span className="text-[0.55rem]" style={{ color: "var(--pn-text-muted)" }}>
          {proposals.length} total
        </span>
      </div>
      {tree.map((node) => (
        <TreeNode key={node.proposal.id} node={node} depth={0} />
      ))}
    </div>
  );
}
