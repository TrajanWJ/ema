export interface VaultNote {
  readonly id: string;
  readonly file_path: string;
  readonly title: string;
  readonly space: string;
  readonly tags: string[];
  readonly word_count: number;
  readonly source_type: string | null;
  readonly project_id: string | null;
  readonly created_at: string;
}

export const EDGE_TYPES = [
  "references",
  "depends-on",
  "implements",
  "contradicts",
  "blocks",
  "enables",
  "supersedes",
  "part-of",
  "related-to",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

export const EDGE_TYPE_CONFIG: Record<EdgeType, { color: string; icon: string; label: string }> = {
  "references": { color: "#6b95f0", icon: "🔗", label: "References" },
  "depends-on": { color: "#f59e0b", icon: "⛓", label: "Depends On" },
  "implements": { color: "#10b981", icon: "⚙", label: "Implements" },
  "contradicts": { color: "#ef4444", icon: "✕", label: "Contradicts" },
  "blocks": { color: "#dc2626", icon: "⊘", label: "Blocks" },
  "enables": { color: "#22d3ee", icon: "▸", label: "Enables" },
  "supersedes": { color: "#a855f7", icon: "⬆", label: "Supersedes" },
  "part-of": { color: "#f97316", icon: "◫", label: "Part Of" },
  "related-to": { color: "#64748b", icon: "↔", label: "Related To" },
};

export interface VaultLink {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly link_text: string;
  readonly link_type: string;
  readonly edge_type: EdgeType;
}

export interface VaultGraph {
  readonly nodes: VaultNote[];
  readonly edges: VaultLink[];
}
