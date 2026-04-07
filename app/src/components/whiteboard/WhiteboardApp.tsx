import { useCallback, useEffect, useRef, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.whiteboard;

type Tool = "pen" | "eraser" | "text" | "rect" | "circle";
type LineSize = "S" | "M" | "L";

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Stroke {
  readonly tool: "pen" | "eraser";
  readonly points: Point[];
  readonly color: string;
  readonly width: number;
}

interface TextElement {
  readonly tool: "text";
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly color: string;
}

interface ShapeElement {
  readonly tool: "rect" | "circle";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
  readonly width: number;
}

type DrawElement = Stroke | TextElement | ShapeElement;

const COLORS = ["#6b95f0", "#2dd4a8", "#f59e0b", "#a78bfa", "#ef4444"] as const;
const SIZE_MAP: Record<LineSize, number> = { S: 2, M: 5, L: 10 };
const TOOLS: { id: Tool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "eraser", label: "Eraser" },
  { id: "text", label: "Text" },
  { id: "rect", label: "Rect" },
  { id: "circle", label: "Circle" },
];

export function WhiteboardApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [elements, setElements] = useState<DrawElement[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0] as string);
  const [size, setSize] = useState<LineSize>("M");

  // Drawing state kept in refs to avoid re-renders during strokes
  const isDrawing = useRef(false);
  const currentStroke = useRef<Point[]>([]);
  const shapeStart = useRef<Point | null>(null);

  const redraw = useCallback(
    (elems: DrawElement[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const el of elems) {
        if (el.tool === "pen" || el.tool === "eraser") {
          const stroke = el as Stroke;
          if (stroke.points.length < 2) continue;
          ctx.beginPath();
          ctx.strokeStyle = stroke.tool === "eraser" ? "#0A0C14" : stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
        } else if (el.tool === "text") {
          const t = el as TextElement;
          ctx.font = "16px system-ui";
          ctx.fillStyle = t.color;
          ctx.fillText(t.text, t.x, t.y);
        } else if (el.tool === "rect") {
          const s = el as ShapeElement;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.width;
          ctx.strokeRect(s.x, s.y, s.w, s.h);
        } else if (el.tool === "circle") {
          const s = el as ShapeElement;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.width;
          ctx.beginPath();
          ctx.ellipse(
            s.x + s.w / 2,
            s.y + s.h / 2,
            Math.abs(s.w / 2),
            Math.abs(s.h / 2),
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
      }
    },
    [],
  );

  // Resize canvas to fill container
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redraw(elements);
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [elements, redraw]);

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e);

    if (tool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        setElements((prev) => {
          const next = [...prev, { tool: "text" as const, x: pos.x, y: pos.y, text, color }];
          redraw(next);
          return next;
        });
      }
      return;
    }

    if (tool === "rect" || tool === "circle") {
      isDrawing.current = true;
      shapeStart.current = pos;
      return;
    }

    // pen or eraser
    isDrawing.current = true;
    currentStroke.current = [pos];
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    if (tool === "rect" || tool === "circle") {
      const start = shapeStart.current;
      if (!start) return;
      // Preview: redraw everything + the in-progress shape
      redraw(elements);
      ctx.strokeStyle = color;
      ctx.lineWidth = SIZE_MAP[size];
      const w = pos.x - start.x;
      const h = pos.y - start.y;
      if (tool === "rect") {
        ctx.strokeRect(start.x, start.y, w, h);
      } else {
        ctx.beginPath();
        ctx.ellipse(
          start.x + w / 2,
          start.y + h / 2,
          Math.abs(w / 2),
          Math.abs(h / 2),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      return;
    }

    // pen/eraser: draw incrementally
    const pts = currentStroke.current;
    const prev = pts[pts.length - 1];
    currentStroke.current.push(pos);

    ctx.beginPath();
    ctx.strokeStyle = tool === "eraser" ? "#0A0C14" : color;
    ctx.lineWidth = SIZE_MAP[size];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool === "rect" || tool === "circle") {
      const start = shapeStart.current;
      if (!start) return;
      const pos = getPos(e);
      const w = pos.x - start.x;
      const h = pos.y - start.y;
      shapeStart.current = null;
      setElements((prev) => {
        const next = [
          ...prev,
          { tool: tool as "rect" | "circle", x: start.x, y: start.y, w, h, color, width: SIZE_MAP[size] },
        ];
        redraw(next);
        return next;
      });
      return;
    }

    // Commit the stroke
    const points = [...currentStroke.current];
    currentStroke.current = [];
    if (points.length < 2) return;
    setElements((prev) => {
      const next = [
        ...prev,
        { tool: tool as "pen" | "eraser", points, color, width: SIZE_MAP[size] },
      ];
      return next;
    });
  }

  function handleClear() {
    setElements([]);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <AppWindowChrome appId="whiteboard" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="glass-surface flex items-center gap-3 px-4 py-2 border-b border-white/[0.06]">
          {/* Tool buttons */}
          <div className="flex gap-1">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className="px-3 py-1.5 rounded-md text-[0.75rem] font-medium transition-colors"
                style={{
                  background: tool === t.id ? "rgba(107,149,240,0.25)" : "rgba(255,255,255,0.04)",
                  color: tool === t.id ? "#6b95f0" : "rgba(255,255,255,0.6)",
                  border: tool === t.id ? "1px solid rgba(107,149,240,0.3)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-white/[0.08]" />

          {/* Color palette */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[0.65rem] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
              Color
            </span>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full transition-transform"
                style={{
                  background: c,
                  transform: color === c ? "scale(1.3)" : "scale(1)",
                  boxShadow: color === c ? `0 0 6px ${c}80` : "none",
                }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-white/[0.08]" />

          {/* Size */}
          <div className="flex gap-1 items-center">
            <span className="text-[0.65rem] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
              Size
            </span>
            {(["S", "M", "L"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className="w-7 h-7 rounded-md text-[0.7rem] font-medium transition-colors"
                style={{
                  background: size === s ? "rgba(107,149,240,0.2)" : "rgba(255,255,255,0.04)",
                  color: size === s ? "#6b95f0" : "rgba(255,255,255,0.5)",
                  border: size === s ? "1px solid rgba(107,149,240,0.25)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Clear */}
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-md text-[0.75rem] font-medium transition-colors"
            style={{
              background: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            Clear
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ cursor: tool === "text" ? "text" : "crosshair" }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (isDrawing.current) {
                isDrawing.current = false;
                currentStroke.current = [];
                shapeStart.current = null;
              }
            }}
          />
        </div>
      </div>
    </AppWindowChrome>
  );
}
