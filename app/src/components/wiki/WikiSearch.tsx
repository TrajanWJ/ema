import { VaultSearch } from "@/components/vault/VaultSearch";

interface WikiSearchProps {
  readonly onSelectNote: (path: string) => void;
}

export function WikiSearch({ onSelectNote }: WikiSearchProps) {
  return <VaultSearch onSelectNote={onSelectNote} />;
}
