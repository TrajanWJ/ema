export interface GitEvent {
  readonly id: string;
  readonly repo_path: string;
  readonly commit_sha: string;
  readonly author: string;
  readonly message: string;
  readonly changed_files: { files: ReadonlyArray<ChangedFile> };
  readonly diff_summary: string;
  readonly sync_actions: ReadonlyArray<WikiSyncAction>;
  readonly inserted_at: string;
  readonly updated_at: string;
}

export interface ChangedFile {
  readonly status: string;
  readonly path: string;
}

export interface WikiSyncAction {
  readonly id: string;
  readonly git_event_id: string;
  readonly action_type: "create_stub" | "flag_outdated" | "update_content";
  readonly wiki_path: string;
  readonly suggestion: string;
  readonly auto_applied: boolean;
  readonly inserted_at: string;
  readonly updated_at: string;
}

export interface SyncStatus {
  readonly watched_repos: ReadonlyArray<string>;
  readonly pending_suggestions: number;
  readonly stale_pages: number;
  readonly recent_events: ReadonlyArray<GitEvent>;
}
