import { useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";

interface TemplateGalleryProps {
  readonly onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  project: "#60a5fa",
  monitoring: "#5eead4",
  brainstorm: "#fbbf24",
  productivity: "#a78bfa",
  planning: "#34d399",
};

export function TemplateGallery({ onClose }: TemplateGalleryProps) {
  const templates = useCanvasStore((s) => s.templates);
  const instantiateTemplate = useCanvasStore((s) => s.instantiateTemplate);

  useEffect(() => {
    useCanvasStore.getState().loadTemplates();
  }, []);

  async function handleInstantiate(templateId: string, name: string) {
    await instantiateTemplate(templateId, name);
    onClose();
  }

  if (templates.length === 0) {
    return (
      <div className="glass-surface rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Templates
          </h3>
          <button
            onClick={onClose}
            className="text-[0.65rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Close
          </button>
        </div>
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          No templates available.
        </span>
      </div>
    );
  }

  // Group by category
  const grouped = templates.reduce<Record<string, typeof templates[number][]>>((acc, tpl) => {
    const cat = tpl.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tpl);
    return acc;
  }, {});

  return (
    <div className="glass-surface rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-[0.75rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Templates
        </h3>
        <button
          onClick={onClose}
          className="text-[0.65rem]"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Close
        </button>
      </div>

      {Object.entries(grouped).map(([category, tpls]) => (
        <div key={category} className="mb-3">
          <div
            className="text-[0.6rem] uppercase tracking-wider mb-2 font-medium"
            style={{ color: CATEGORY_COLORS[category] ?? "var(--pn-text-tertiary)" }}
          >
            {category}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tpls.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleInstantiate(tpl.id, tpl.name)}
                className="text-left p-3 rounded-lg transition-colors hover:bg-white/5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--pn-border-subtle)" }}
              >
                <div className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
                  {tpl.name}
                </div>
                {tpl.description && (
                  <div className="text-[0.6rem] mt-1 line-clamp-2" style={{ color: "var(--pn-text-tertiary)" }}>
                    {tpl.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
