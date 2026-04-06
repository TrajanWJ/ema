import { useMemo } from "react";
import { useExecutionStore } from "../../store/executionStore";
import { useProjectStore } from "../../store/projectStore";
import { useUIStore } from "../../store/uiStore";
import { StatCards } from "./StatCards";
import { ExecutionFeed } from "../widgets/ExecutionFeed";
import { AgentWidget } from "../widgets/AgentWidget";
import { SupermanWidget } from "../widgets/SupermanWidget";
import { BrainDumpWidget } from "../widgets/BrainDumpWidget";

function WidgetShell({ title, icon, type, children }: { title: string; icon: string; type: string; children: React.ReactNode }) {
  const openFloat = useUIStore((state) => state.openFloat);
  return (
    <div className="glass widget">
      <div className="widget-header">
        <div className="row">
          <span>{icon}</span>
          <strong>{title}</strong>
        </div>
        <button onClick={() => openFloat(type, title)}>↗ float</button>
      </div>
      <div className="widget-body">{children}</div>
    </div>
  );
}

export function Dashboard() {
  const projects = useProjectStore((state) => state.projects);
  const context = useProjectStore((state) => state.activeProjectContext);
  const executions = useExecutionStore((state) => state.executions);

  const filteredExecutions = useMemo(
    () => (context?.project?.id ? executions.filter((item) => item.project_id === context.project.id) : executions),
    [context?.project?.id, executions]
  );

  const stats = {
    running: filteredExecutions.filter((item) => item.status === "running").length,
    projects: projects.length,
    brainDump: context?.brainDump?.length ?? 0,
    completedToday: filteredExecutions.filter((item) => item.status === "completed").length
  };

  return (
    <div className="page">
      <StatCards {...stats} />
      <div className="widget-grid">
        <WidgetShell title="Execution Feed" icon="⚡" type="executions">
          <ExecutionFeed />
        </WidgetShell>
        <WidgetShell title="Agent Dispatch" icon="🤖" type="agents">
          <AgentWidget />
        </WidgetShell>
        <WidgetShell title="Superman" icon="🧠" type="superman">
          <SupermanWidget />
        </WidgetShell>
        <WidgetShell title="Brain Dump" icon="💭" type="braindump">
          <BrainDumpWidget />
        </WidgetShell>
      </div>
    </div>
  );
}
