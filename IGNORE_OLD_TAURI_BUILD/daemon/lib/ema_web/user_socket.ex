defmodule EmaWeb.UserSocket do
  use Phoenix.Socket

  alias EmaWeb.AccessControl

  channel "dashboard:*", EmaWeb.DashboardChannel
  channel "brain_dump:*", EmaWeb.BrainDumpChannel
  channel "habits:*", EmaWeb.HabitsChannel
  channel "journal:*", EmaWeb.JournalChannel
  channel "settings:*", EmaWeb.SettingsChannel
  channel "workspace:*", EmaWeb.WorkspaceChannel
  channel "projects:*", EmaWeb.ProjectChannel
  channel "sessions:*", EmaWeb.SessionChannel
  channel "tasks:*", EmaWeb.TaskChannel
  channel "proposals:*", EmaWeb.ProposalChannel
  channel "vault:*", EmaWeb.VaultChannel
  channel "pipes:*", EmaWeb.PipesChannel
  channel "responsibilities:*", EmaWeb.ResponsibilityChannel
  channel "agent_network:*", EmaWeb.AgentNetworkChannel
  channel "agents:lobby", EmaWeb.AgentLobbyChannel
  channel "agents:chat:*", EmaWeb.AgentChatChannel
  channel "canvas:*", EmaWeb.CanvasChannel
  channel "claude_sessions:*", EmaWeb.ClaudeSessionChannel
  channel "voice:*", EmaWeb.VoiceChannel
  channel "channels:*", EmaWeb.ChannelsChannel
  channel "evolution:*", EmaWeb.EvolutionChannel
  channel "metamind:*", EmaWeb.MetaMindChannel
  channel "goals:*", EmaWeb.GoalChannel
  channel "focus:*", EmaWeb.FocusChannel
  channel "notes:*", EmaWeb.NotesChannel
  channel "cli_manager:*", EmaWeb.CliManagerChannel
  channel "dispatch_board:*", EmaWeb.DispatchBoardChannel
  channel "superman:*", EmaWeb.SupermanChannel
  channel "orgs:*", EmaWeb.OrgChannel
  channel "temporal:*", EmaWeb.TemporalChannel
  channel "memory:*", EmaWeb.MemoryChannel
  channel "gaps:*", EmaWeb.GapChannel
  channel "intent:*", EmaWeb.IntentChannel
  channel "intents:*", EmaWeb.IntentsChannel
  channel "executions:*", EmaWeb.ExecutionChannel
  channel "intelligence:*", EmaWeb.IntelligenceChannel
  channel "prompts:*", EmaWeb.PromptsChannel
  channel "pipeline:*", EmaWeb.PipelineChannel
  channel "decisions:*", EmaWeb.DecisionChannel
  channel "jarvis:*", EmaWeb.JarvisChannel
  channel "project_graph:*", EmaWeb.ProjectGraphChannel
  channel "knowledge_graph:*", EmaWeb.KnowledgeGraphChannel
  channel "actors:*", EmaWeb.ActorsChannel

  @impl true
  def connect(params, socket, connect_info) do
    ip = get_in(connect_info, [:peer_data, :ip])
    token = Map.get(params, "token") || Map.get(params, "api_token")

    cond do
      AccessControl.local_request?(ip) ->
        {:ok, socket}

      token && AccessControl.token_allowed?(token) ->
        {:ok, socket}

      true ->
        :error
    end
  end

  @impl true
  def id(_socket), do: nil
end
