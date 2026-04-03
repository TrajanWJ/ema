import { useRef, useCallback } from "react";
import type { CanvasElement as CanvasElementType } from "@/types/canvas";

interface CanvasElementProps {
  readonly element: CanvasElementType;
  readonly selected: boolean;
  readonly zoom: number;
  readonly gridSnap: boolean;
  readonly onSelect: (id: string) => void;
  readonly onMove: (id: string, x: number, y: number) => void;
  readonly onResize: (id: string, width: number, height: number) => void;
}

const GRID_SIZE = 20;

function snapToGrid(value: number, snap: boolean): number {
  if (!snap) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; radius: string }> = {
  sticky: { bg: "rgba(251, 191, 36, 0.15)", border: "rgba(251, 191, 36, 0.4)", radius: "4px" },
  text: { bg: "transparent", border: "transparent", radius: "0" },
  rectangle: { bg: "rgba(255, 255, 255, 0.04)", border: "rgba(255, 255, 255, 0.15)", radius: "6px" },
  ellipse: { bg: "rgba(255, 255, 255, 0.04)", border: "rgba(255, 255, 255, 0.15)", radius: "50%" },
  number_card: { bg: "rgba(94, 234, 212, 0.08)", border: "rgba(94, 234, 212, 0.3)", radius: "8px" },
  bar_chart: { bg: "rgba(107, 149, 240, 0.08)", border: "rgba(107, 149, 240, 0.3)", radius: "8px" },
  line_chart: { bg: "rgba(107, 149, 240, 0.08)", border: "rgba(107, 149, 240, 0.3)", radius: "8px" },
  pie_chart: { bg: "rgba(167, 139, 250, 0.08)", border: "rgba(167, 139, 250, 0.3)", radius: "8px" },
  sparkline: { bg: "rgba(52, 211, 153, 0.08)", border: "rgba(52, 211, 153, 0.3)", radius: "8px" },
  gauge: { bg: "rgba(248, 113, 113, 0.08)", border: "rgba(248, 113, 113, 0.3)", radius: "8px" },
  scatter: { bg: "rgba(107, 149, 240, 0.08)", border: "rgba(107, 149, 240, 0.3)", radius: "8px" },
  heatmap: { bg: "rgba(251, 191, 36, 0.08)", border: "rgba(251, 191, 36, 0.3)", radius: "8px" },
  connection: { bg: "transparent", border: "transparent", radius: "0" },
};

function renderLiveData(element: CanvasElementType) {
  const data = element.live_data;
  if (!data) {
    return (
      <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
        {element.data_source ?? "No data"}
      </span>
    );
  }

  if (Array.isArray(data) && data.length > 0) {
    return (
      <div className="text-[0.6rem] space-y-0.5 overflow-hidden" style={{ color: "var(--pn-text-secondary)" }}>
        {(data as Record<string, unknown>[]).slice(0, 5).map((row, i) => (
          <div key={i} className="truncate">
            {Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(", ")}
          </div>
        ))}
        {data.length > 5 && (
          <div style={{ color: "var(--pn-text-muted)" }}>+{data.length - 5} more</div>
        )}
      </div>
    );
  }

  return (
    <div className="text-[0.7rem] font-mono" style={{ color: "var(--pn-text-secondary)" }}>
      {JSON.stringify(data).slice(0, 100)}
    </div>
  );
}

export function CanvasElementComponent({
  element,
  selected,
  zoom,
  gridSnap,
  onSelect,
  onMove,
  onResize,
}: CanvasElementProps) {
  const dragRef = useRef<{ startX: number; startY: number; elX: number; elY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; elW: number; elH: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (element.locked) return;
      e.stopPropagation();
      onSelect(element.id);

      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        elX: element.x,
        elY: element.y,
      };
    },
    [element.id, element.x, element.y, element.locked, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startX) / zoom;
        const dy = (e.clientY - dragRef.current.startY) / zoom;
        const newX = snapToGrid(dragRef.current.elX + dx, gridSnap);
        const newY = snapToGrid(dragRef.current.elY + dy, gridSnap);
        onMove(element.id, newX, newY);
      }
      if (resizeRef.current) {
        const dx = (e.clientX - resizeRef.current.startX) / zoom;
        const dy = (e.clientY - resizeRef.current.startY) / zoom;
        const newW = Math.max(40, snapToGrid(resizeRef.current.elW + dx, gridSnap));
        const newH = Math.max(30, snapToGrid(resizeRef.current.elH + dy, gridSnap));
        onResize(element.id, newW, newH);
      }
    },
    [element.id, zoom, gridSnap, onMove, onResize]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (element.locked) return;
      e.stopPropagation();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        elW: element.width,
        elH: element.height,
      };
    },
    [element.width, element.height, element.locked]
  );

  const style = TYPE_STYLES[element.element_type] ?? TYPE_STYLES.rectangle;
  const customColor = (element.style as Record<string, string>)?.color;

  return (
    <div
      style={{
        position: "absolute",
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        background: customColor ? `${customColor}22` : style.bg,
        border: `1px solid ${selected ? "#6b95f0" : (customColor ? `${customColor}66` : style.border)}`,
        borderRadius: style.radius,
        zIndex: element.z_index,
        cursor: element.locked ? "default" : "grab",
        boxShadow: selected ? "0 0 0 2px rgba(107, 149, 240, 0.3)" : "none",
        transition: "box-shadow 0.15s",
        overflow: "hidden",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Element type badge */}
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[0.55rem] uppercase tracking-wider font-medium"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {element.element_type}
          </span>
          {element.data_source && (
            <span className="text-[0.5rem] px-1 py-0.5 rounded" style={{ background: "rgba(94, 234, 212, 0.15)", color: "#5eead4" }}>
              live
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {element.text && (
            <div
              className="text-[0.7rem] leading-relaxed"
              style={{
                color: "var(--pn-text-primary)",
                fontWeight: (element.style as Record<string, string>)?.fontWeight === "bold" ? 600 : 400,
                fontSize: (element.style as Record<string, number>)?.fontSize
                  ? `${(element.style as Record<string, number>).fontSize}px`
                  : undefined,
              }}
            >
              {element.text}
            </div>
          )}
          {element.data_source && renderLiveData(element)}
        </div>
      </div>

      {/* Resize handle */}
      {selected && !element.locked && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 12,
            height: 12,
            cursor: "se-resize",
            background: "rgba(107, 149, 240, 0.4)",
            borderRadius: "2px 0 0 0",
          }}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
    </div>
  );
}
