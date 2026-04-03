import { Shell } from "@/components/layout/Shell";
import { Launchpad } from "@/components/layout/Launchpad";
import { BrainDumpApp } from "@/components/brain-dump/BrainDumpApp";
import { HabitsApp } from "@/components/habits/HabitsApp";
import { JournalApp } from "@/components/journal/JournalApp";
import { ProposalsApp } from "@/components/proposals/ProposalsApp";
import { ProjectsApp } from "@/components/projects/ProjectsApp";
import { TasksApp } from "@/components/tasks/TasksApp";
import { SettingsApp } from "@/components/settings/SettingsApp";
import { ResponsibilitiesApp } from "@/components/responsibilities/ResponsibilitiesApp";
import { AgentsApp } from "@/components/agents/AgentsApp";
import { VaultApp } from "@/components/vault/VaultApp";
import { CanvasApp } from "@/components/canvas/CanvasApp";
import { PipesApp } from "@/components/pipes/PipesApp";
import { ChannelsApp } from "@/components/channels/ChannelsApp";
import { MetaMindApp } from "@/components/metamind/MetaMindApp";
import { EvolutionDashboard } from "@/components/evolution/EvolutionDashboard";
import { ClaudeBridgeApp } from "@/components/claude-bridge/ClaudeBridgeApp";
import { VoiceApp } from "@/components/voice/VoiceApp";
import { GoalsApp } from "@/components/goals/GoalsApp";
import { FocusApp } from "@/components/focus/FocusApp";
import { GitSyncApp } from "@/components/git-sync/GitSyncApp";
import { OpenClawApp } from "@/components/openclaw/OpenClawApp";
import { CliManagerApp } from "@/components/cli-manager/CliManagerApp";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { OrbWindow } from "@/components/orb/OrbWindow";
import { JarvisApp } from "@/components/jarvis/JarvisApp";

function getRoute(): string {
  return window.location.pathname.replace(/^\/+/, "") || "launchpad";
}

function AppContent() {
  const route = getRoute();

  switch (route) {
    case "brain-dump":
      return <BrainDumpApp />;
    case "habits":
      return <HabitsApp />;
    case "journal":
      return <JournalApp />;
    case "proposals":
      return <ProposalsApp />;
    case "projects":
      return <ProjectsApp />;
    case "tasks":
      return <TasksApp />;
    case "settings":
      return <SettingsApp />;
    case "responsibilities":
      return <ResponsibilitiesApp />;
    case "agents":
      return <AgentsApp />;
    case "vault":
      return <VaultApp />;
    case "canvas":
      return <CanvasApp />;
    case "channels":
      return <ChannelsApp />;
    case "evolution":
      return <EvolutionDashboard />;
    case "pipes":
      return <PipesApp />;
    case "metamind":
      return <MetaMindApp />;
    case "claude-bridge":
      return <ClaudeBridgeApp />;
    case "voice":
      return <VoiceApp />;
    case "goals":
      return <GoalsApp />;
    case "focus":
      return <FocusApp />;
    case "git-sync":
      return <GitSyncApp />;
    case "openclaw":
      return <OpenClawApp />;
    case "cli-manager":
      return <CliManagerApp />;
    case "orb":
      return <OrbWindow />;
    case "jarvis":
      return <JarvisApp />;
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
