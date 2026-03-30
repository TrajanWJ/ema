import { useEffect } from "react";
import { usePipesStore } from "@/stores/pipes-store";

export function PipeCatalog() {
  const catalog = usePipesStore((s) => s.catalog);
  const loadCatalog = usePipesStore((s) => s.loadCatalog);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  if (!catalog) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Loading catalog...
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Triggers column */}
      <div className="flex-1">
        <h3
          className="text-[0.7rem] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "#a78bfa" }}
        >
          Triggers ({catalog.triggers.length})
        </h3>
        <div className="space-y-1.5">
          {catalog.triggers.map((trigger) => (
            <div key={trigger.id} className="glass-surface rounded-md p-2">
              <div
                className="text-[0.7rem] font-mono font-medium"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {trigger.id}
              </div>
              <div className="text-[0.6rem] mt-0.5" style={{ color: "var(--pn-text-tertiary)" }}>
                {trigger.description}
              </div>
            </div>
          ))}
          {catalog.triggers.length === 0 && (
            <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              No triggers registered
            </span>
          )}
        </div>
      </div>

      {/* Actions column */}
      <div className="flex-1">
        <h3
          className="text-[0.7rem] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "#2dd4a8" }}
        >
          Actions ({catalog.actions.length})
        </h3>
        <div className="space-y-1.5">
          {catalog.actions.map((action) => (
            <div key={action.id} className="glass-surface rounded-md p-2">
              <div
                className="text-[0.7rem] font-mono font-medium"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {action.id}
              </div>
              <div className="text-[0.6rem] mt-0.5" style={{ color: "var(--pn-text-tertiary)" }}>
                {action.description}
              </div>
            </div>
          ))}
          {catalog.actions.length === 0 && (
            <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              No actions registered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
