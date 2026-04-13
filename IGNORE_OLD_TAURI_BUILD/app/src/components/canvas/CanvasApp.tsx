import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useCanvasStore } from "@/stores/canvas-store";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { APP_CONFIGS } from "@/types/workspace";
import { CanvasList } from "./CanvasList";
import { CanvasEditor } from "./CanvasEditor";

const config = APP_CONFIGS["canvas"];

const CANVAS_TYPES = ["freeform", "dashboard", "planning", "research", "monitoring"] as const;

export function CanvasApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("freeform");
  const canvases = useCanvasStore((s) => s.canvases);
  const selectedCanvasId = useCanvasStore((s) => s.selectedCanvasId);
  const selectCanvas = useCanvasStore((s) => s.selectCanvas);
  const createCanvas = useCanvasStore((s) => s.createCanvas);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await useCanvasStore.getState().loadViaRest();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load canvases");
      }
      if (!cancelled) setReady(true);
      useCanvasStore.getState().connect().catch(() => {
        console.warn("Canvas WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const selectedCanvas = canvases.find((c) => c.id === selectedCanvasId) ?? null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    await createCanvas({ name: trimmed, canvas_type: newType });
    setNewName("");
    setShowCreate(false);
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="canvas" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const inputStyle = {
    background: "var(--pn-surface-3)",
    color: "var(--pn-text-primary)",
    border: "1px solid var(--pn-border-default)",
  };

  return (
    <AppWindowChrome
      appId="canvas"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={selectedCanvas ? selectedCanvas.name : "All Canvases"}
    >
      {selectedCanvas ? (
        <CanvasEditor
          canvas={selectedCanvas}
          onBack={() => useCanvasStore.setState({ selectedCanvasId: null, elements: [] })}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[0.875rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
              Canvases
            </h2>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="text-[0.7rem] px-3 py-1 rounded-md transition-opacity hover:opacity-80"
              style={{ background: "#6b95f0", color: "#fff" }}
            >
              + New
            </button>
          </div>

          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
              {error}
            </div>
          )}

          {showCreate && (
            <form onSubmit={handleCreate} className="glass-surface rounded-lg p-4 mb-4">
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Canvas name"
                  className="flex-1 text-[0.8rem] px-3 py-2 rounded-lg outline-none"
                  style={inputStyle}
                />
                <GlassSelect
                  value={newType}
                  onChange={(val) => setNewType(val)}
                  options={CANVAS_TYPES.map((t) => ({ value: t, label: t }))}
                  size="sm"
                />
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="text-[0.7rem] px-4 py-1.5 rounded-md font-medium transition-opacity disabled:opacity-30"
                  style={{ background: "#6b95f0", color: "#fff" }}
                >
                  Create
                </button>
              </div>
            </form>
          )}

          <CanvasList canvases={canvases} onSelect={selectCanvas} />
        </>
      )}
    </AppWindowChrome>
  );
}
