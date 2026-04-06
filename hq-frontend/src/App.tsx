import { useEffect, useMemo, useState } from "react";
import { getHealth } from "./api/hq";
import { socketManager } from "./api/socket";
import { Dashboard } from "./components/dashboard/Dashboard";
import { AgentsPage } from "./components/pages/AgentsPage";
import { BrainDumpPage } from "./components/pages/BrainDumpPage";
import { ExecutionsPage } from "./components/pages/ExecutionsPage";
import { ProjectsPage } from "./components/pages/ProjectsPage";
import { FloatingWindow } from "./components/shell/FloatingWindow";
import { Sidebar } from "./components/shell/Sidebar";
import { TopBar } from "./components/shell/TopBar";
import { useExecutionStore } from "./store/executionStore";
import { useProjectStore } from "./store/projectStore";
import { useUIStore } from "./store/uiStore";

export default function App() {
  const [health, setHealth] = useState<any>(null);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const refreshContext = useProjectStore((state) => state.refreshContext);
  const loadExecutions = useExecutionStore((state) => state.loadExecutions);
  const addEvent = useExecutionStore((state) => state.addEvent);
  const addExecution = useExecutionStore((state) => state.addExecution);
  const updateExecution = useExecutionStore((state) => state.updateExecution);
  const { activePage, floatingWindows, sidebarOpen } = useUIStore();

  useEffect(() => {
    void loadProjects();
    void loadExecutions();
    socketManager.connect();

    const onAgentEvent = (payload: any) => {
      if (!payload.taskId) return;
      addEvent(payload.taskId, payload);
      if (payload.type === "complete") updateExecution(payload.taskId, { status: "completed" });
      if (payload.type === "error") updateExecution(payload.taskId, { status: "failed" });
    };
    const onExecutionStarted = (payload: any) => {
      if (payload.execution) addExecution(payload.execution);
    };
    const onExecutionUpdated = async (payload: any) => {
      updateExecution(payload.taskId, { status: payload.status });
      await loadExecutions();
      await refreshContext();
    };
    const onBrainDumpAdded = async () => {
      await refreshContext();
    };

    socketManager.on("agent_event", onAgentEvent);
    socketManager.on("execution_started", onExecutionStarted);
    socketManager.on("execution_updated", onExecutionUpdated);
    socketManager.on("brain_dump_added", onBrainDumpAdded);

    void getHealth().then(setHealth).catch(() => null);
    const timer = window.setInterval(() => {
      void getHealth().then(setHealth).catch(() => null);
    }, 5000);

    return () => {
      window.clearInterval(timer);
      socketManager.off("agent_event", onAgentEvent);
      socketManager.off("execution_started", onExecutionStarted);
      socketManager.off("execution_updated", onExecutionUpdated);
      socketManager.off("brain_dump_added", onBrainDumpAdded);
    };
  }, [addEvent, addExecution, loadExecutions, loadProjects, refreshContext, updateExecution]);

  const page = useMemo(() => {
    switch (activePage) {
      case "projects":
        return <ProjectsPage />;
      case "executions":
        return <ExecutionsPage />;
      case "agents":
        return <AgentsPage />;
      case "braindump":
        return <BrainDumpPage />;
      default:
        return <Dashboard />;
    }
  }, [activePage]);

  return (
    <div className="app-shell">
      <TopBar health={health} />
      <Sidebar />
      <main
        className="main-content"
        style={{ marginTop: 36, marginLeft: sidebarOpen ? 190 : 54, transition: "margin-left 0.2s ease" }}
      >
        {page}
      </main>
      {floatingWindows.map((windowState) => (
        <FloatingWindow key={windowState.id} windowState={windowState}>
          {windowState.type === "executions" && <Dashboard />}
          {windowState.type === "agents" && <AgentsPage />}
          {windowState.type === "superman" && <Dashboard />}
          {windowState.type === "braindump" && <BrainDumpPage />}
        </FloatingWindow>
      ))}
    </div>
  );
}
