import { useVaultStore } from "@/stores/vault-store";

export function WikiStats() {
  const notes = useVaultStore((s) => s.notes);
  const graph = useVaultStore((s) => s.graph);

  const spaces = new Map<string, number>();
  for (const note of notes) {
    if (note.space) {
      spaces.set(note.space, (spaces.get(note.space) ?? 0) + 1);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label="Notes" value={notes.length} color="#2dd4a8" />
      <StatCard label="Edges" value={graph?.edges.length ?? 0} color="#6b95f0" />
      <StatCard label="Spaces" value={spaces.size} color="#f59e0b" />
    </div>
  );
}

function StatCard({ label, value, color }: { readonly label: string; readonly value: number; readonly color: string }) {
  return (
    <div className="glass-surface rounded-lg p-4 text-center">
      <div className="text-[1.5rem] font-semibold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[0.6rem] uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>{label}</div>
    </div>
  );
}
