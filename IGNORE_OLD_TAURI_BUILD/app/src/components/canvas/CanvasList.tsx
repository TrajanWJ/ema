import type { Canvas } from "@/types/canvas";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface CanvasListProps {
  readonly canvases: readonly Canvas[];
  readonly onSelect: (id: string) => void;
}

export function CanvasList({ canvases, onSelect }: CanvasListProps) {
  if (canvases.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          No canvases yet. Create one to get started.
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {canvases.map((canvas) => (
        <button
          key={canvas.id}
          onClick={() => onSelect(canvas.id)}
          className="glass-surface rounded-lg p-4 text-left transition-colors hover:bg-white/5"
        >
          <div
            className="text-[0.8rem] font-medium mb-1"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {canvas.name}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[0.6rem] px-1.5 py-0.5 rounded-md font-mono"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                color: "var(--pn-text-tertiary)",
              }}
            >
              {canvas.canvas_type}
            </span>
            <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              {formatDate(canvas.created_at)}
            </span>
          </div>
          {canvas.description && (
            <div
              className="text-[0.65rem] mt-2 line-clamp-2"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              {canvas.description}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
