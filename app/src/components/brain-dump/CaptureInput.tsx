import { useState, useEffect } from "react";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useProjectsStore } from "@/stores/projects-store";

export function CaptureInput() {
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const add = useBrainDumpStore((s) => s.add);
  const projects = useProjectsStore((s) => s.projects);
  const loaded = useProjectsStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded) {
      useProjectsStore.getState().loadViaRest().catch(() => {
        // Projects endpoint may not exist yet
      });
    }
  }, [loaded]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    add(trimmed, undefined, projectId);
    setText("");
  }

  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "incubating");

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
      <select
        value={projectId ?? ""}
        onChange={(e) => setProjectId(e.target.value || null)}
        className="text-[0.7rem] px-2 py-2 rounded-lg outline-none"
        style={{
          background: "var(--pn-surface-3)",
          color: "var(--pn-text-secondary)",
          border: "1px solid var(--pn-border-default)",
          maxWidth: "140px",
        }}
      >
        <option value="">Inbox</option>
        {activeProjects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
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
