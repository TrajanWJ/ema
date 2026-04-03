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
import { ExecutionsApp } from "@/components/executions/ExecutionsApp";
import { GitSyncApp } from "@/components/git-sync/GitSyncApp";
import { OpenClawApp } from "@/components/openclaw/OpenClawApp";
import { CliManagerApp } from "@/components/cli-manager/CliManagerApp";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { OrbWindow } from "@/components/orb/OrbWindow";
import { JarvisApp } from "@/components/jarvis/JarvisApp";
// Chunk 2: AI Pipeline & Management
import PipelineApp from "@/components/pipeline/PipelineApp";
import { AgentFleetApp } from "@/components/agent-fleet/AgentFleetApp";
import { PromptWorkshopApp } from "@/components/prompt-workshop/PromptWorkshopApp";
import { IngestorApp } from "@/components/ingestor/IngestorApp";
import { DecisionLogApp } from "@/components/decision-log/DecisionLogApp";
// Chunk 3: P2P Services
import { FileVaultApp } from "@/components/file-vault/FileVaultApp";
import { MessageHubApp } from "@/components/message-hub/MessageHubApp";
import { SharedClipboardApp } from "@/components/shared-clipboard/SharedClipboardApp";
import { ServiceDashboardApp } from "@/components/service-dashboard/ServiceDashboardApp";
import { TunnelManagerApp } from "@/components/tunnel-manager/TunnelManagerApp";
// Chunk 4: Personal Executive Management
import { LifeDashboardApp } from "@/components/life-dashboard/LifeDashboardApp";
import { RoutineBuilderApp } from "@/components/routine-builder/RoutineBuilderApp";
import { FinanceTrackerApp } from "@/components/finance-tracker/FinanceTrackerApp";
import { ContactsCRMApp } from "@/components/contacts-crm/ContactsCRMApp";
import { GoalPlannerApp } from "@/components/goal-planner/GoalPlannerApp";
// Chunk 5: Business/Organization Management
import { TeamPulseApp } from "@/components/team-pulse/TeamPulseApp";
import { MeetingRoomApp } from "@/components/meeting-room/MeetingRoomApp";
import { ProjectPortfolioApp } from "@/components/project-portfolio/ProjectPortfolioApp";
import { InvoiceBillingApp } from "@/components/invoice-billing/InvoiceBillingApp";
import { AuditTrailApp } from "@/components/audit-trail/AuditTrailApp";
// Monitoring & Intelligence
import { TokenMonitorApp } from "@/components/tokens/TokenMonitor";
import { VMHealthApp } from "@/components/vm/VMHealthPanel";
import { SecurityPanelApp } from "@/components/security/SecurityPanel";
// Intelligence & Knowledge (Batch 3)
import { SessionMemoryApp } from "@/components/memory/SessionMemoryApp";
import { GapInboxApp } from "@/components/gaps/GapInboxApp";
import { IntentMapApp } from "@/components/intent/IntentMapApp";
import { CodeHealthDashboard } from "@/components/superman/CodeHealthDashboard";
import { ProjectGraphApp } from "@/components/project-graph/ProjectGraphApp";
// Organizations & P2P
import { OrgApp } from "@/components/org/OrgApp";

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
    case "executions":
      return <ExecutionsApp />;
    case "openclaw":
      return <OpenClawApp />;
    case "cli-manager":
      return <CliManagerApp />;
    case "orb":
      return <OrbWindow />;
    case "jarvis":
      return <JarvisApp />;
    // Chunk 2
    case "pipeline":
      return <PipelineApp />;
    case "agent-fleet":
      return <AgentFleetApp />;
    case "prompt-workshop":
      return <PromptWorkshopApp />;
    case "ingestor":
      return <IngestorApp />;
    case "decision-log":
      return <DecisionLogApp />;
    // Chunk 3
    case "file-vault":
      return <FileVaultApp />;
    case "message-hub":
      return <MessageHubApp />;
    case "shared-clipboard":
      return <SharedClipboardApp />;
    case "service-dashboard":
      return <ServiceDashboardApp />;
    case "tunnel-manager":
      return <TunnelManagerApp />;
    // Chunk 4
    case "life-dashboard":
      return <LifeDashboardApp />;
    case "routine-builder":
      return <RoutineBuilderApp />;
    case "finance-tracker":
      return <FinanceTrackerApp />;
    case "contacts-crm":
      return <ContactsCRMApp />;
    case "goal-planner":
      return <GoalPlannerApp />;
    // Chunk 5
    case "team-pulse":
      return <TeamPulseApp />;
    case "meeting-room":
      return <MeetingRoomApp />;
    case "project-portfolio":
      return <ProjectPortfolioApp />;
    case "invoice-billing":
      return <InvoiceBillingApp />;
    case "audit-trail":
      return <AuditTrailApp />;
    // Organizations
    case "org":
      return <OrgApp />;
    // Monitoring & Intelligence
    case "token-monitor":
      return <TokenMonitorApp />;
    case "vm-health":
      return <VMHealthApp />;
    case "security":
      return <SecurityPanelApp />;
    // Intelligence & Knowledge (Batch 3)
    case "memory":
      return <SessionMemoryApp />;
    case "gaps":
      return <GapInboxApp />;
    case "intent-map":
      return <IntentMapApp />;
    case "project-graph":
      return <ProjectGraphApp />;
    case "code-health":
      return <CodeHealthDashboard />;
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
