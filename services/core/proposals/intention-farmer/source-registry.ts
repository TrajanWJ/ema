/**
 * SourceRegistry — in-memory registry of intent sources.
 *
 * Ports `Ema.IntentionFarmer.SourceRegistry` from the old Elixir daemon,
 * minus the Claude/Codex filesystem scanners. The new build keeps the
 * registry itself generic and leaves source-type behaviour to whoever
 * registers a SourceDefinition — we don't want this subservice to know
 * about `~/.claude` or `~/.codex` paths directly.
 */

export type SourceKind = "vault" | "git-commit" | "channel" | "brain-dump";

export interface SourceDefinition {
  id: string;
  kind: SourceKind;
  config: Record<string, unknown>;
}

export class SourceRegistry {
  private readonly sources = new Map<string, SourceDefinition>();

  add(def: SourceDefinition): void {
    this.sources.set(def.id, def);
  }

  remove(id: string): boolean {
    return this.sources.delete(id);
  }

  get(id: string): SourceDefinition | undefined {
    return this.sources.get(id);
  }

  list(): SourceDefinition[] {
    return Array.from(this.sources.values());
  }

  listByKind(kind: SourceKind): SourceDefinition[] {
    return this.list().filter((def) => def.kind === kind);
  }

  clear(): void {
    this.sources.clear();
  }
}
