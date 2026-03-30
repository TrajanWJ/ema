export interface VaultNote {
  readonly id: string;
  readonly file_path: string;
  readonly title: string;
  readonly space: string;
  readonly tags: string[];
  readonly word_count: number;
  readonly source_type: string | null;
  readonly project_id: string | null;
  readonly inserted_at: string;
}

export interface VaultLink {
  readonly source_note_id: string;
  readonly target_note_id: string;
  readonly link_text: string;
  readonly link_type: string;
}

export interface VaultGraph {
  readonly nodes: VaultNote[];
  readonly edges: VaultLink[];
}
