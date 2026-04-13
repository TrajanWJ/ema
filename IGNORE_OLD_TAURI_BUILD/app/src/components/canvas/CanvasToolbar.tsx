import type { ElementType } from "@/types/canvas";

const QUICK_ADD: { type: ElementType; label: string; icon: string }[] = [
  { type: "sticky", label: "Sticky", icon: "\u25A1" },
  { type: "text", label: "Text", icon: "T" },
  { type: "rectangle", label: "Rect", icon: "\u25AD" },
  { type: "ellipse", label: "Circle", icon: "\u25CB" },
  { type: "number_card", label: "Data", icon: "#" },
  { type: "connection", label: "Line", icon: "\u2015" },
];

interface CanvasToolbarProps {
  readonly onAddElement: (type: ElementType) => void;
  readonly gridSnap: boolean;
  readonly onToggleGrid: () => void;
  readonly zoom: number;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onZoomReset: () => void;
}

export function CanvasToolbar({
  onAddElement,
  gridSnap,
  onToggleGrid,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: CanvasToolbarProps) {
  return (
    <div
      className="glass-elevated flex items-center gap-1 px-2 py-1 rounded-lg"
      style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
    >
      {QUICK_ADD.map((item) => (
        <button
          key={item.type}
          onClick={() => onAddElement(item.type)}
          className="px-2 py-1 rounded text-[0.65rem] hover:bg-white/10 transition-colors"
          style={{ color: "var(--pn-text-secondary)" }}
          title={`Add ${item.label}`}
        >
          <span className="block text-center text-[0.8rem]">{item.icon}</span>
          <span className="block text-center">{item.label}</span>
        </button>
      ))}

      <div className="w-px h-6 mx-1" style={{ background: "var(--pn-border-subtle)" }} />

      <button
        onClick={onToggleGrid}
        className="px-2 py-1 rounded text-[0.65rem] hover:bg-white/10 transition-colors"
        style={{ color: gridSnap ? "#5eead4" : "var(--pn-text-muted)" }}
        title="Toggle grid snap"
      >
        <span className="block text-center text-[0.8rem]">#</span>
        <span className="block text-center">Grid</span>
      </button>

      <div className="w-px h-6 mx-1" style={{ background: "var(--pn-border-subtle)" }} />

      <button
        onClick={onZoomOut}
        className="px-1.5 py-1 rounded text-[0.75rem] hover:bg-white/10 transition-colors"
        style={{ color: "var(--pn-text-secondary)" }}
        title="Zoom out"
      >
        -
      </button>
      <button
        onClick={onZoomReset}
        className="px-2 py-1 rounded text-[0.6rem] font-mono hover:bg-white/10 transition-colors"
        style={{ color: "var(--pn-text-tertiary)" }}
        title="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        className="px-1.5 py-1 rounded text-[0.75rem] hover:bg-white/10 transition-colors"
        style={{ color: "var(--pn-text-secondary)" }}
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}
