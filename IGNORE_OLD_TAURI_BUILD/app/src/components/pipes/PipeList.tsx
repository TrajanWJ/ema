import type { Pipe } from "@/types/pipes";
import { PipeCard } from "./PipeCard";

interface PipeListProps {
  readonly pipes: readonly Pipe[];
  readonly emptyMessage?: string;
}

export function PipeList({ pipes, emptyMessage = "No pipes found" }: PipeListProps) {
  if (pipes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          {emptyMessage}
        </span>
      </div>
    );
  }

  return (
    <div>
      {pipes.map((pipe) => (
        <PipeCard key={pipe.id} pipe={pipe} />
      ))}
    </div>
  );
}
