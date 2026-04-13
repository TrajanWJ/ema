/**
 * Composer types — provider-agnostic LLM call wrapper.
 *
 * Composer writes inspectable artifacts to disk BEFORE a token is spent.
 * Pattern recovered from the old Elixir build's InkOS Composer
 * (see IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/proposal_engine/composer.ex).
 */

export interface CompileMetadata {
  intentSlug?: string;
  actorId?: string;
  purpose?: string;
}

export interface CompileInput {
  prompt: string;
  context?: Record<string, unknown>;
  metadata?: CompileMetadata;
}

export interface CompiledArtifact {
  runId: string;
  /** Absolute path to the per-run artifact directory. */
  artifactDir: string;
  /** Absolute path to the prompt markdown file. */
  promptPath: string;
  /** Absolute path to the context JSON file. */
  contextPath: string;
  /** Absolute path to the response markdown file. Exists only after recordResponse(). */
  responsePath: string;
}

export interface CompileResult {
  artifact: CompiledArtifact;
  /** Non-fatal issues encountered during compilation (e.g. partial artifact write). */
  warnings: string[];
}

/**
 * On-disk shape of context.json. Stored separately from the prompt so a
 * human or agent can inspect the exact inputs a later LLM call will see.
 */
export interface ContextFile {
  runId: string;
  compiledAt: string;
  metadata: CompileMetadata;
  context: Record<string, unknown>;
}
