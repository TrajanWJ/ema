import type { CanvasElement } from "@/types/canvas";

interface CanvasMinimapProps {
  readonly elements: readonly CanvasElement[];
  readonly viewport: { x: number; y: number; zoom: number };
  readonly containerWidth: number;
  readonly containerHeight: number;
  readonly onNavigate: (x: number, y: number) => void;
}

const MINIMAP_W = 160;
const MINIMAP_H = 100;

export function CanvasMinimap({
  elements,
  viewport,
  containerWidth,
  containerHeight,
  onNavigate,
}: CanvasMinimapProps) {
  if (elements.length === 0) return null;

  // Compute bounds of all elements
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  // Add padding
  const pad = 100;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);

  // Viewport rectangle in minimap coords
  const vpX = (-viewport.x / viewport.zoom - minX) * scale;
  const vpY = (-viewport.y / viewport.zoom - minY) * scale;
  const vpW = (containerWidth / viewport.zoom) * scale;
  const vpH = (containerHeight / viewport.zoom) * scale;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = clickX / scale + minX;
    const worldY = clickY / scale + minY;
    onNavigate(-worldX * viewport.zoom + containerWidth / 2, -worldY * viewport.zoom + containerHeight / 2);
  }

  return (
    <div
      className="absolute bottom-3 right-3 glass-elevated rounded-lg overflow-hidden cursor-crosshair"
      style={{ width: MINIMAP_W, height: MINIMAP_H, border: "1px solid var(--pn-border-subtle)" }}
      onClick={handleClick}
    >
      <svg width={MINIMAP_W} height={MINIMAP_H}>
        {/* Element dots */}
        {elements.map((el) => (
          <rect
            key={el.id}
            x={(el.x - minX) * scale}
            y={(el.y - minY) * scale}
            width={Math.max(el.width * scale, 2)}
            height={Math.max(el.height * scale, 2)}
            fill={el.data_source ? "rgba(94, 234, 212, 0.6)" : "rgba(255, 255, 255, 0.3)"}
            rx={1}
          />
        ))}
        {/* Viewport indicator */}
        <rect
          x={vpX}
          y={vpY}
          width={vpW}
          height={vpH}
          fill="none"
          stroke="rgba(107, 149, 240, 0.6)"
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  );
}
