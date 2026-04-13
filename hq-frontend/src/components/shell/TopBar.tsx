import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useOrgStore } from "../../store/orgStore";
import { useSpaceStore } from "../../store/spaceStore";
import { useUIStore } from "../../store/uiStore";
import { socketManager } from "../../api/socket";

interface TopBarProps {
  health: any;
}

function statusColor(ok: boolean | undefined) {
  return ok ? "var(--green)" : "var(--red)";
}

export function TopBar({ health }: TopBarProps) {
  const [clock, setClock] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const { projects, activeProjectId, setActiveProject } = useProjectStore();
  const orgs = useOrgStore((state) => state.orgs);
  const activeOrg = useOrgStore((state) => state.activeOrg);
  const setActiveOrg = useOrgStore((state) => state.setActiveOrg);
  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const setActiveSpace = useSpaceStore((state) => state.setActiveSpace);
  const { activePage, projectSwitcherOpen, toggleProjectSwitcher, toggleSidebar, setPage } = useUIStore();

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!projectSwitcherOpen) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggleProjectSwitcher();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [projectSwitcherOpen, toggleProjectSwitcher]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const filtered = projects.filter((project) =>
    project.name.toLowerCase().includes(query.toLowerCase())
  );
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) || null,
    [spaces, activeSpaceId]
  );

  async function handleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser denied the request; keep the control inert rather than surfacing noise.
    }
  }

  function handleCloseAttempt() {
    window.close();
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: "0 0 auto 0",
          height: 36,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          background: "rgba(7,9,15,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)"
        }}
      >
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <div className="traffic topbar-traffic">
            <button type="button" style={{ background: "#ff5f57" }} aria-label="Close" onClick={handleCloseAttempt} />
            <button type="button" style={{ background: "#febc2e" }} aria-label="Toggle sidebar" onClick={toggleSidebar} />
            <button type="button" style={{ background: "#28c840" }} aria-label="Toggle fullscreen" onClick={() => { void handleFullscreen(); }} />
          </div>
          <select
            className="glass topbar-select"
            value={activeSpaceId || ""}
            onChange={(event) => setActiveSpace(event.target.value || null)}
            aria-label="Select space"
          >
            <option value="">{activeSpace ? activeSpace.name : "Select space"}</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
          <select
            className="glass topbar-select"
            value={activeOrg?.id || ""}
            onChange={(event) =>
              setActiveOrg(orgs.find((org) => org.id === event.target.value) || null)
            }
            aria-label="Select organization"
          >
            <option value="">Personal</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <span style={{ color: "var(--accent)" }}>◈</span>
          <strong>HQ</strong>
          <span className="dim">›</span>
          <span style={{ textTransform: "capitalize" }}>{activePage}</span>
        </div>

        <button className="glass pill topbar-project-switcher" onClick={toggleProjectSwitcher}>
          {activeProject ? (
            <span className="row">
              <span className="status-dot" style={{ background: activeProject.color || "var(--accent)" }} />
              <span>{activeProject.name}</span>
              <span className="status-dot" style={{ background: activeProject.status === "active" ? "var(--green)" : "var(--orange)" }} />
            </span>
          ) : (
            <span className="muted">Select project</span>
          )}
        </button>

        <div className="row">
          <span className="status-dot" style={{ background: statusColor(health?.checks?.api === "ok") }} />
          <span className="status-dot" style={{ background: statusColor(health?.checks?.agent?.status === "ok") }} />
          <span className="status-dot" style={{ background: statusColor(health?.checks?.superman?.status === "ok") }} />
          {socketManager.isConnected && <span className="badge" style={{ color: "var(--green)" }}>LIVE</span>}
          <span>{clock.toLocaleTimeString()}</span>
        </div>
      </div>

      {projectSwitcherOpen && (
        <div className="modal-backdrop" onClick={toggleProjectSwitcher}>
          <div className="glass modal" onClick={(event) => event.stopPropagation()} style={{ width: 420 }}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <strong>Projects</strong>
              <button onClick={() => { toggleProjectSwitcher(); setPage("projects"); }}>New project</button>
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" />
            <div className="card-list" style={{ marginTop: 12, maxHeight: 360, overflow: "auto" }}>
              {filtered.map((project) => (
                <button
                  key={project.id}
                  className="card"
                  style={{ textAlign: "left" }}
                  onClick={async () => {
                    await setActiveProject(project.id);
                    toggleProjectSwitcher();
                  }}
                >
                  <div className="row-between">
                    <div className="row">
                      <span className="status-dot" style={{ background: project.color || "var(--accent)" }} />
                      <strong>{project.name}</strong>
                    </div>
                    <span className="badge">{project.status || "active"}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {project.last_execution ? `Last active ${new Date(project.last_execution * 1000).toLocaleString()}` : "No executions yet"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
