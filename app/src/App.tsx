// EMA UI 2.0 — 27 apps
// Keep: Brain Dump, Tasks, Projects, Executions, Intent Schematic, Wiki, Agents,
//       Proposals, Canvas, Pipes, Evolution, Governance, Habits, Journal, Focus,
//       Responsibilities, Settings, Voice, Campaigns, Babysitter, Temporal/Rhythm,
//       Agent Workspace, Whiteboard, Storyboard, Operator Chat, Agent Chat, HQ

import { Shell } from "@/components/layout/Shell";
import { Launchpad } from "@/components/layout/Launchpad";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";

// Core Workflow
import { BrainDumpApp } from "@/components/brain-dump/BrainDumpApp";
import { TasksApp } from "@/components/tasks/TasksApp";
import { ProjectsApp } from "@/components/projects/ProjectsApp";
import { ExecutionsApp } from "@/components/executions/ExecutionsApp";
import { ProposalsApp } from "@/components/proposals/ProposalsApp";

// Intelligence
import { IntentSchematicApp } from "@/components/intents/IntentSchematicApp";
import { WikiApp } from "@/components/wiki/WikiApp";
import { AgentsApp } from "@/components/agents/AgentsApp";

// Creative
import { CanvasApp } from "@/components/canvas/CanvasApp";
import { PipesApp } from "@/components/pipes/PipesApp";
import { EvolutionDashboard } from "@/components/evolution/EvolutionDashboard";
// TODO: WhiteboardApp — Excalidraw-powered free-form drawing (Phase 5)
// TODO: StoryboardApp — sequential narrative planning (Phase 5)

// Operations
import { DecisionLogApp } from "@/components/decision-log/DecisionLogApp";
import { CampaignsApp } from "@/components/campaigns/CampaignsApp";
// TODO: GovernanceApp — policy engine, trust scoring, cost gates (Phase 5)
// TODO: BabysitterApp — system health, anomaly detection (Phase 5)

// Life
import { HabitsApp } from "@/components/habits/HabitsApp";
import { JournalApp } from "@/components/journal/JournalApp";
import { FocusApp } from "@/components/focus/FocusApp";
import { ResponsibilitiesApp } from "@/components/responsibilities/ResponsibilitiesApp";
import { TemporalApp } from "@/components/temporal/TemporalApp";
import { GoalsApp } from "@/components/goals/GoalsApp";

// System
import { SettingsApp } from "@/components/settings/SettingsApp";
import { VoiceApp } from "@/components/voice/VoiceApp";
// TODO: AgentWorkspaceApp — MCP phase cadence viewer (Phase 5)
// TODO: OperatorChatApp — calm unified chat to drive EMA (Phase 5)
// TODO: AgentChatApp — chat WITH agents (Phase 5)
// TODO: HQApp — dynamic widget home surface (Phase 3)

function getRoute(): string {
  return window.location.pathname.replace(/^\/+/, "") || "launchpad";
}

function AppContent() {
  const route = getRoute();

  switch (route) {
    // Core Workflow
    case "brain-dump":
      return <BrainDumpApp />;
    case "tasks":
      return <TasksApp />;
    case "projects":
      return <ProjectsApp />;
    case "executions":
      return <ExecutionsApp />;
    case "proposals":
      return <ProposalsApp />;

    // Intelligence
    case "intent-schematic":
      return <IntentSchematicApp />;
    case "wiki":
      return <WikiApp />;
    case "agents":
      return <AgentsApp />;

    // Creative
    case "canvas":
      return <CanvasApp />;
    case "pipes":
      return <PipesApp />;
    case "evolution":
      return <EvolutionDashboard />;

    // Operations
    case "decision-log":
      return <DecisionLogApp />;
    case "campaigns":
      return <CampaignsApp />;

    // Life
    case "habits":
      return <HabitsApp />;
    case "journal":
      return <JournalApp />;
    case "focus":
      return <FocusApp />;
    case "responsibilities":
      return <ResponsibilitiesApp />;
    case "temporal":
      return <TemporalApp />;
    case "goals":
      return <GoalsApp />;

    // System
    case "settings":
      return <SettingsApp />;
    case "voice":
      return <VoiceApp />;

    // Default: Launchpad (will become HQ in Phase 3)
    default:
      return (
        <Shell>
          <Launchpad />
        </Shell>
      );
  }
}

export default function App() {
  return (
    <>
      <AppContent />
      <VoiceOverlay />
    </>
  );
}
