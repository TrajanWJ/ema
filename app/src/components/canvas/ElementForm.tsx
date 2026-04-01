import { useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { GlassSelect } from "@/components/ui/GlassSelect";

const ELEMENT_TYPES = [
  "rectangle", "ellipse", "text", "sticky",
  "bar_chart", "line_chart", "pie_chart", "sparkline",
  "number_card", "gauge", "scatter", "heatmap",
] as const;

const DATA_SOURCES = [
  "tasks:by_status", "tasks:by_project", "tasks:completed_over_time",
  "proposals:by_confidence", "proposals:approval_rate",
  "habits:completion_rate", "habits:streaks",
  "responsibilities:health",
  "sessions:token_usage", "sessions:by_project",
  "vault:notes_by_space", "vault:link_density",
] as const;

interface ElementFormProps {
  readonly onClose: () => void;
}

export function ElementForm({ onClose }: ElementFormProps) {
  const [elementType, setElementType] = useState<string>("rectangle");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(150);
  const [dataSource, setDataSource] = useState<string>("");
  const addElement = useCanvasStore((s) => s.addElement);

  const isChart = elementType.includes("chart") || elementType === "sparkline"
    || elementType === "number_card" || elementType === "gauge"
    || elementType === "scatter" || elementType === "heatmap";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addElement({
      element_type: elementType,
      x, y, width, height,
      rotation: 0,
      z_index: 0,
      style: {},
      text: null,
      data_source: isChart ? dataSource || null : null,
      data_config: {},
      chart_config: {},
      refresh_interval: null,
    });
    onClose();
  }

  const inputStyle = {
    background: "var(--pn-surface-3)",
    color: "var(--pn-text-primary)",
    border: "1px solid var(--pn-border-default)",
  };

  return (
    <form onSubmit={handleSubmit} className="glass-surface rounded-lg p-4 mb-4">
      <h3
        className="text-[0.75rem] font-medium uppercase tracking-wider mb-3"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        Add Element
      </h3>

      <GlassSelect
        value={elementType}
        onChange={(val) => setElementType(val)}
        options={ELEMENT_TYPES.map((t) => ({ value: t, label: t }))}
        className="w-full mb-2"
        size="sm"
      />

      <div className="grid grid-cols-4 gap-2 mb-2">
        {[
          { label: "X", value: x, set: setX },
          { label: "Y", value: y, set: setY },
          { label: "W", value: width, set: setWidth },
          { label: "H", value: height, set: setHeight },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <label className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>{label}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => set(Number(e.target.value))}
              className="w-full text-[0.7rem] px-2 py-1 rounded-md outline-none"
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      {isChart && (
        <GlassSelect
          value={dataSource}
          onChange={(val) => setDataSource(val)}
          options={[
            { value: "", label: "Select data source..." },
            ...DATA_SOURCES.map((ds) => ({ value: ds, label: ds })),
          ]}
          placeholder="Select data source..."
          className="w-full mb-2"
          size="sm"
        />
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-[0.7rem] px-3 py-1.5 rounded-md"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="text-[0.7rem] px-4 py-1.5 rounded-md font-medium"
          style={{ background: "#6b95f0", color: "#fff" }}
        >
          Add
        </button>
      </div>
    </form>
  );
}
