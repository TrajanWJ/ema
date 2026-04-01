import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useClaudeBridgeStore } from "@/stores/claude-bridge-store";
import { useProjectsStore } from "@/stores/projects-store";
import { APP_CONFIGS } from "@/types/workspace";
import { SessionList } from "./SessionList";
import { SessionView } from "./SessionView";
import { ProjectPicker } from "./ProjectPicker";
import type { Project } from "@/types/projects";

const config = APP_CONFIGS["claude-bridge"];

export function ClaudeBridgeApp() {
  const [ready, setReady] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [model, setModel] = useState("sonnet");
  const [initialPrompt, setInitialPrompt] = useState("");

  const createSession = useClaudeBridgeStore((s) => s.createSession);
  const sendPrompt = useClaudeBridgeStore((s) => s.sendPrompt);
  const sessions = useClaudeBridgeStore((s) => s.sessions);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useProjectsStore.getState().loadViaRest().catch(() => {});
      if (!cancelled) setReady(true);

      useClaudeBridgeStore.getState().connect().catch(() => {
        console.warn("Claude Bridge WS not available");
      });
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!selectedProject?.linked_path) return;

    const session = await createSession(
      selectedProject.linked_path,
      model,
      selectedProject.id,
    );

    if (session && initialPrompt.trim()) {
      sendPrompt(session.id, initialPrompt.trim());
    }

    setShowNewSession(false);
    setInitialPrompt("");
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="claude-bridge" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="claude-bridge" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex h-full overflow-hidden -m-4">
        {/* Sidebar */}
        <div
          className="flex flex-col shrink-0"
          style={{
            width: "240px",
            borderRight: "1px solid var(--pn-border-subtle)",
            background: "var(--color-pn-surface-1)",
          }}
        >
          {/* New session button */}
          <div className="p-2" style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}>
            <button
              onClick={() => setShowNewSession(!showNewSession)}
              className="w-full rounded-md px-3 py-1.5 text-[0.7rem] font-medium transition-colors"
              style={{
                background: "rgba(45, 212, 168, 0.12)",
                color: "#2dd4a8",
                border: "1px solid rgba(45, 212, 168, 0.25)",
              }}
            >
              + New Session
            </button>
          </div>

          {/* New session form */}
          {showNewSession && (
            <div
              className="flex flex-col gap-2 p-2"
              style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
            >
              <ProjectPicker
                selectedId={selectedProject?.id ?? null}
                onSelect={setSelectedProject}
              />

              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md px-2 py-1.5 text-[0.75rem] font-mono outline-none"
                style={{
                  background: "var(--color-pn-surface-2)",
                  color: "var(--pn-text-primary)",
                  border: "1px solid var(--pn-border-default)",
                }}
              >
                <option value="sonnet">Sonnet</option>
                <option value="opus">Opus</option>
                <option value="haiku">Haiku</option>
              </select>

              <input
                type="text"
                value={initialPrompt}
                onChange={(e) => setInitialPrompt(e.target.value)}
                placeholder="Initial prompt (optional)"
                className="w-full rounded-md px-2 py-1.5 text-[0.75rem] font-mono outline-none"
                style={{
                  background: "var(--color-pn-surface-2)",
                  color: "var(--pn-text-primary)",
                  border: "1px solid var(--pn-border-default)",
                }}
              />

              <button
                onClick={handleCreate}
                disabled={!selectedProject?.linked_path}
                className="w-full rounded-md px-3 py-1.5 text-[0.7rem] font-medium transition-opacity"
                style={{
                  background: selectedProject?.linked_path ? "#2dd4a8" : "var(--color-pn-surface-2)",
                  color: selectedProject?.linked_path ? "#060610" : "var(--pn-text-muted)",
                  opacity: selectedProject?.linked_path ? 1 : 0.5,
                }}
              >
                Launch
              </button>
            </div>
          )}

          {/* Session list */}
          <div className="flex-1 overflow-auto">
            <SessionList />
          </div>

          {/* Session count footer */}
          <div
            className="px-3 py-1.5 text-center"
            style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
          >
            <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
              {sessions.length} session{sessions.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Main view */}
        <SessionView />
      </div>
    </AppWindowChrome>
  );
}
