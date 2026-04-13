import { VaultGraph } from "@/components/vault/VaultGraph";

interface WikiGraphProps {
  readonly onSelectNote: (path: string) => void;
}

export function WikiGraph({ onSelectNote: _onSelectNote }: WikiGraphProps) {
  return <VaultGraph />;
}
