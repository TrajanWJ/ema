import { useVaultStore } from "@/stores/vault-store";

interface WikiIndexProps {
  readonly onSelectNote: (path: string) => void;
}

export function WikiIndex({ onSelectNote }: WikiIndexProps) {
  const notes = useVaultStore((s) => s.notes);

  return (
    <div className="overflow-auto">
      <div className="text-[0.7rem] font-medium mb-2" style={{ color: "var(--pn-text-secondary)" }}>
        All Notes ({notes.length})
      </div>
      <div className="flex flex-col gap-0.5">
        {notes.map((note) => (
          <button
            key={note.id}
            onClick={() => onSelectNote(note.file_path)}
            className="text-left px-2 py-1.5 rounded text-[0.7rem] truncate transition-colors hover:bg-white/5"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {note.title || note.file_path}
          </button>
        ))}
      </div>
    </div>
  );
}
