import { useEffect } from "react";
import { usePipesStore } from "@/stores/pipes-store";
import { PipeList } from "./PipeList";

export function SystemPipes() {
  const systemPipes = usePipesStore((s) => s.systemPipes);

  useEffect(() => {
    usePipesStore.getState().loadSystemPipes();
  }, []);

  return (
    <div>
      <p className="text-[0.7rem] mb-3" style={{ color: "var(--pn-text-tertiary)" }}>
        Stock behaviors that ship with EMA. These can be toggled but not deleted.
      </p>
      <PipeList pipes={systemPipes} emptyMessage="No system pipes loaded" />
    </div>
  );
}
