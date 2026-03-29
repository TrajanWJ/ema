import { useState } from "react";
import { useBrainDumpStore } from "@/stores/brain-dump-store";

export function CaptureInput() {
  const [text, setText] = useState("");
  const add = useBrainDumpStore((s) => s.add);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    add(trimmed);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Capture a thought..."
        className="flex-1 text-[0.8rem] px-3 py-2 rounded-lg outline-none"
        style={{
          background: "var(--pn-surface-3)",
          color: "var(--pn-text-primary)",
          border: "1px solid var(--pn-border-default)",
        }}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="text-[0.8rem] px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-30"
        style={{
          background: "var(--color-pn-primary-400)",
          color: "#fff",
        }}
      >
        Add
      </button>
    </form>
  );
}
