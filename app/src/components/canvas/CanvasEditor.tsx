import { useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import type { Canvas } from "@/types/canvas";
import { ElementForm } from "./ElementForm";

interface CanvasEditorProps {
  readonly canvas: Canvas;
  readonly onBack: () => void;
}

export function CanvasEditor({ canvas, onBack }: CanvasEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const elements = useCanvasStore((s) => s.elements);
  const removeElement = useCanvasStore((s) => s.removeElement);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          &larr;
        </button>
        <div className="flex-1">
          <div className="text-[0.875rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
            {canvas.name}
          </div>
          <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            {canvas.canvas_type} · {elements.length} elements
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[0.7rem] px-3 py-1 rounded-md transition-opacity hover:opacity-80"
          style={{ background: "#6b95f0", color: "#fff" }}
        >
          + Element
        </button>
      </div>

      {showForm && (
        <ElementForm onClose={() => setShowForm(false)} />
      )}

      {elements.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            Canvas is empty. Add elements to get started.
          </span>
        </div>
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}>
                {["Type", "Position", "Size", "Data Source", ""].map((h) => (
                  <th
                    key={h}
                    className="text-[0.6rem] font-medium uppercase tracking-wider text-left px-3 py-2"
                    style={{ color: "var(--pn-text-tertiary)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elements.map((el) => (
                <tr
                  key={el.id}
                  style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
                >
                  <td className="text-[0.7rem] px-3 py-2" style={{ color: "var(--pn-text-primary)" }}>
                    <span
                      className="px-1.5 py-0.5 rounded-md font-mono text-[0.6rem]"
                      style={{ background: "rgba(255, 255, 255, 0.04)" }}
                    >
                      {el.element_type}
                    </span>
                  </td>
                  <td className="text-[0.7rem] px-3 py-2 font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
                    {Math.round(el.x)}, {Math.round(el.y)}
                  </td>
                  <td className="text-[0.7rem] px-3 py-2 font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
                    {Math.round(el.width)}x{Math.round(el.height)}
                  </td>
                  <td className="text-[0.7rem] px-3 py-2" style={{ color: "var(--pn-text-tertiary)" }}>
                    {el.data_source ?? "--"}
                  </td>
                  <td className="text-[0.7rem] px-3 py-2 text-right">
                    <button
                      onClick={() => removeElement(el.id)}
                      className="text-[0.6rem] opacity-40 hover:opacity-80 transition-opacity"
                      style={{ color: "#ef4444" }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
