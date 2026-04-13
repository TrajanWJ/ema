export interface InboxItem {
  readonly id: string;
  readonly content: string;
  readonly source: "text" | "shortcut" | "clipboard";
  readonly processed: boolean;
  readonly action: "task" | "journal" | "archive" | "note" | "processing" | null;
  readonly processed_at: string | null;
  readonly created_at: string;
  readonly project_id: string | null;
}
