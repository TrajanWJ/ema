defmodule Ema.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children =
      [
        EmaWeb.Telemetry,
        Ema.Repo,
        {Ecto.Migrator,
         repos: Application.fetch_env!(:ema, :ecto_repos), skip: skip_migrations?()},
        {DNSCluster, query: Application.get_env(:ema, :dns_cluster_query) || :ignore},
        {Phoenix.PubSub, name: Ema.PubSub},
        # Agent process registry and supervisor
        {Registry, keys: :unique, name: Ema.Agents.Registry},
        {Task.Supervisor, name: Ema.TaskSupervisor},
        Ema.Agents.Supervisor,
        Ema.Agents.NetworkMonitor,
        # AI session tracking
        Ema.Claude.SessionManager,
        # Focus timer GenServer
        Ema.Focus.Timer,
        # Pipes — workflow automation (Registry -> Loader -> Executor)
        Ema.Pipes.Supervisor,
        # Ingest job processor
        Ema.Ingestor.Processor,
        # Intelligence — token tracking, trust scoring, VM monitoring, cost forecasting
        Ema.Intelligence.TokenTracker,
        Ema.Executions.Dispatcher,
        Ema.Intelligence.TrustScorer,
        Ema.Intelligence.VmMonitor,
        Ema.Intelligence.CostForecaster,
        Ema.Intelligence.SessionMemoryWatcher,
        Ema.Intelligence.GapScanner,
        # CLI Manager — process registry and supervisor for session runners
        {Registry, keys: :unique, name: Ema.CliManager.Registry},
        {DynamicSupervisor, name: Ema.CliManager.RunnerSupervisor, strategy: :one_for_one}
      ] ++
        maybe_start_session_store() ++
        maybe_start_quality() ++
        maybe_start_orchestration() ++
        maybe_start_bridge() ++
        maybe_start_claude_sessions() ++
        maybe_start_canvas() ++
        maybe_start_second_brain() ++
        maybe_start_responsibilities() ++
        maybe_start_vectors() ++
        maybe_start_proposal_engine() ++
        maybe_start_metamind() ++
        maybe_start_evolution() ++
        maybe_start_voice() ++
        maybe_start_git_watcher() ++
        maybe_start_harvesters() ++
        maybe_start_temporal() ++
        maybe_start_openclaw() ++
        maybe_start_mcp() ++
        [
          # Start to serve requests, typically the last entry
          EmaWeb.Endpoint
        ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Ema.Supervisor]
    result = Supervisor.start_link(children, opts)

    # Seed and start OpenClaw agents after supervision tree is up
    Task.start(fn ->
      Process.sleep(2_000)
      Ema.Agents.OpenClawSync.sync()
    end)

    result
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    EmaWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp skip_migrations?() do
    # By default, sqlite migrations are run when using a release
    System.get_env("RELEASE_NAME") == nil
  end

  defp maybe_start_session_store do
    if Application.get_env(:ema, :start_session_store, true) do
      [Ema.Persistence.SessionStore]
    else
      []
    end
  end

  defp maybe_start_bridge do
    if Application.get_env(:ema, :ai_backend) == :bridge do
      [Ema.Claude.BridgeSupervisor]
    else
      []
    end
  end

  defp maybe_start_claude_sessions do
    if Application.get_env(:ema, :start_claude_sessions, true) do
      [Ema.ClaudeSessions.Supervisor]
    else
      []
    end
  end

  defp maybe_start_canvas do
    if Application.get_env(:ema, :start_canvas, true) do
      [Ema.Canvas.Supervisor]
    else
      []
    end
  end

  defp maybe_start_second_brain do
    if Application.get_env(:ema, :start_second_brain, true) do
      [Ema.SecondBrain.Supervisor]
    else
      []
    end
  end

  defp maybe_start_responsibilities do
    if Application.get_env(:ema, :start_otp_workers, true) do
      [Ema.Responsibilities.Supervisor]
    else
      []
    end
  end

  defp maybe_start_vectors do
    if Application.get_env(:ema, :proposal_engine)[:enabled] do
      [Ema.Vectors.Supervisor]
    else
      []
    end
  end

  defp maybe_start_voice do
    if Application.get_env(:ema, :start_voice, true) do
      [Ema.Voice.Supervisor]
    else
      []
    end
  end


  defp maybe_start_proposal_engine do
    if Application.get_env(:ema, :proposal_engine)[:enabled] do
      [Ema.ProposalEngine.Supervisor]
    else
      []
    end
  end

  defp maybe_start_metamind do
    if Application.get_env(:ema, :metamind)[:enabled] do
      [Ema.MetaMind.Supervisor]
    else
      []
    end
  end

  defp maybe_start_git_watcher do
    if Application.get_env(:ema, :start_git_watcher, true) do
      [Ema.Intelligence.GitWatcher]
    else
      []
    end
  end

  defp maybe_start_harvesters do
    if Application.get_env(:ema, :start_harvesters, true) do
      [Ema.Harvesters.Supervisor]
    else
      []
    end
  end

  defp maybe_start_openclaw do
    if Application.get_env(:ema, :start_openclaw, true) do
      [Ema.OpenClaw.AgentBridge]
    else
      []
    end
  end

  defp maybe_start_evolution do
    if Application.get_env(:ema, :evolution_engine, true) do
      [Ema.Evolution.Supervisor]
    else
      []
    end
  end

  defp maybe_start_temporal do
    if Application.get_env(:ema, :start_temporal, true) do
      [Ema.Temporal.Engine]
    else
      []
    end
  end

  defp maybe_start_quality do
    if Application.get_env(:ema, :start_quality, true) do
      [Ema.Quality.Supervisor]
    else
      []
    end
  end

  defp maybe_start_orchestration do
    if Application.get_env(:ema, :start_orchestration, true) do
      [Ema.Orchestration.Supervisor]
    else
      []
    end
  end

  defp maybe_start_mcp do
    if Application.get_env(:ema, :mcp_server, [])[:enabled] do
      # Initialize the ETS table for recursion guard before server starts
      Ema.MCP.RecursionGuard.init()
      [Ema.MCP.Server]
    else
      []
    end
  end
end
