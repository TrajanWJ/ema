// EMA Electron renderer entrypoint. App readiness and grouping now live in config/app-catalog.
// VoiceOverlay removed — was causing mic permission errors and floating orb

import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Launchpad } from "@/components/layout/Launchpad";
import { isDesktopEnvironment } from "@/lib/electron-bridge";
import { getCurrentRoute, isStandaloneWindow, navigateToRoute } from "@/lib/router";
import { openApp } from "@/lib/window-manager";
import { APP_CONFIGS } from "@/types/workspace";

// Core Workflow
import { BrainDumpApp } from "@/components/brain-dump/BrainDumpApp";
import { TasksApp } from "@/components/tasks/TasksApp";
import { ProjectsApp } from "@/components/projects/ProjectsApp";
import { ExecutionsApp } from "@/components/executions/ExecutionsApp";
import { ProposalsApp } from "@/components/proposals/ProposalsApp";
import { DeskApp } from "@/components/desk/DeskApp";
import { AgendaApp } from "@/components/agenda/AgendaApp";

// Intelligence
import { BlueprintPlannerApp } from "@/components/blueprint-planner/BlueprintPlannerApp";
import { IntentSchematicApp } from "@/components/intents/IntentSchematicApp";
import { WikiApp } from "@/components/wiki/WikiApp";
import { AgentsApp } from "@/components/agents/AgentsApp";
import { FeedsApp } from "@/components/feeds/FeedsApp";

// Creative
import { CanvasApp } from "@/components/canvas/CanvasApp";
import { PipesApp } from "@/components/pipes/PipesApp";
import { EvolutionDashboard } from "@/components/evolution/EvolutionDashboard";
import { WhiteboardApp } from "@/components/whiteboard/WhiteboardApp";
import { StoryboardApp } from "@/components/storyboard/StoryboardApp";

// Operations
import { DecisionLogApp } from "@/components/decision-log/DecisionLogApp";
import { CampaignsApp } from "@/components/campaigns/CampaignsApp";
import { GovernanceApp } from "@/components/governance/GovernanceApp";
import { BabysitterApp } from "@/components/babysitter/BabysitterApp";

// Life
import { HabitsApp } from "@/components/habits/HabitsApp";
import { JournalApp } from "@/components/journal/JournalApp";
import { FocusApp } from "@/components/focus/FocusApp";
import { ResponsibilitiesApp } from "@/components/responsibilities/ResponsibilitiesApp";
import { TemporalApp } from "@/components/temporal/TemporalApp";
import { GoalsApp } from "@/components/goals/GoalsApp";

// System
import { SettingsApp } from "@/components/settings/SettingsApp";
import { TerminalApp } from "@/components/terminal/TerminalApp";
import { VoiceApp } from "@/components/voice/VoiceApp";
import { HQApp } from "@/components/hq/HQApp";
import { PatternLabApp } from "@/components/pattern-lab/PatternLabApp";

// Chat
import { OperatorChatApp } from "@/components/operator-chat/OperatorChatApp";
import { AgentChatApp } from "@/components/agent-chat/AgentChatApp";

function AppContent() {
  const [route, setRoute] = useState(() => getCurrentRoute());

  useEffect(() => {
    const syncRoute = () => setRoute(getCurrentRoute());

    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);

    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  const isLaunchpad = route === "launchpad" || route === "";
  const needsDesktopPopout =
    isDesktopEnvironment() &&
    !isStandaloneWindow() &&
    !isLaunchpad &&
    Object.prototype.hasOwnProperty.call(APP_CONFIGS, route);

  useEffect(() => {
    if (!needsDesktopPopout) return;
    void openApp(route);
    navigateToRoute("launchpad");
  }, [needsDesktopPopout, route]);

  const content = (() => {
    switch (route) {
      // Core Workflow
      case "desk": return <DeskApp />;
      case "agenda": return <AgendaApp />;
      case "brain-dump": return <BrainDumpApp />;
      case "tasks": return <TasksApp />;
      case "projects": return <ProjectsApp />;
      case "executions": return <ExecutionsApp />;
      case "proposals": return <ProposalsApp />;

      // Intelligence
      case "blueprint-planner": return <BlueprintPlannerApp />;
      case "intent-schematic": return <IntentSchematicApp />;
      case "wiki": return <WikiApp />;
      case "agents": return <AgentsApp />;
      case "feeds": return <FeedsApp />;

      // Creative
      case "canvas": return <CanvasApp />;
      case "pipes": return <PipesApp />;
      case "evolution": return <EvolutionDashboard />;
      case "whiteboard": return <WhiteboardApp />;
      case "storyboard": return <StoryboardApp />;

      // Operations
      case "decision-log": return <DecisionLogApp />;
      case "campaigns": return <CampaignsApp />;
      case "governance": return <GovernanceApp />;
      case "babysitter": return <BabysitterApp />;

      // Life
      case "habits": return <HabitsApp />;
      case "journal": return <JournalApp />;
      case "focus": return <FocusApp />;
      case "responsibilities": return <ResponsibilitiesApp />;
      case "temporal": return <TemporalApp />;
      case "goals": return <GoalsApp />;

      // System
      case "settings": return <SettingsApp />;
      case "terminal": return <TerminalApp />;
      case "voice": return <VoiceApp />;
      case "hq": return <HQApp />;
      case "pattern-lab": return <PatternLabApp />;

      // Chat
      case "operator-chat": return <OperatorChatApp />;
      case "agent-chat": return <AgentChatApp />;

      // Default
      default: return <Launchpad />;
    }
  })();

  return isLaunchpad ? (
    <Shell showAmbientStrip>
      {content}
    </Shell>
  ) : (
    <Shell hideDock showAmbientStrip={false}>
      {needsDesktopPopout ? <Launchpad /> : content}
    </Shell>
  );
}

export default function App() {
  return <AppContent />;
}
