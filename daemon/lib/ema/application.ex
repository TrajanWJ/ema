defmodule Ema.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    unless System.get_env("DISCORD_BOT_TOKEN") do
      require Logger
      unless System.get_env("EMA_MCP_STDIO") in ["1", "true", "TRUE"] do
        Logger.warning("DISCORD_BOT_TOKEN not set — Discord delivery will be unavailable")
      end
    end

    children =
      [
        EmaWeb.Telemetry,
        Ema.Repo,
        {Ecto.Migrator,
         repos: Application.fetch_env!(:ema, :ecto_repos), skip: skip_migrations?()},
        {DNSCluster, query: Application.get_env(:ema, :dns_cluster_query) || :ignore},
        {Phoenix.PubSub, name: Ema.PubSub},
        # Babysitter — system observability and Discord stream-of-consciousness
        # Feedback layer — Discord delivery consumers + EMA internal visibility
        Ema.Feedback.Supervisor,
        # Agent process registry and supervisor
        {Registry, keys: :unique, name: Ema.Agents.Registry},
        {Task.Supervisor, name: Ema.TaskSupervisor},
        Ema.Prompts.Loader,
        Ema.Prompts.Optimizer,
        Ema.Agents.Supervisor,
        Ema.Agents.NetworkMonitor,
        # AI session tracking
        Ema.Claude.SessionManager,
        # Async Claude dispatch with request tracking and retries
        Ema.Claude.BridgeDispatch,
        # Focus timer GenServer
        Ema.Focus.Timer,
        # Pipes — workflow automation (Registry -> Loader -> Executor)
        Ema.Pipes.Supervisor,
        # Ingest job processor
        Ema.Ingestor.Processor,
        # Intelligence — token tracking, trust scoring, VM monitoring, cost forecasting
        Ema.Intelligence.TokenTracker,
        Ema.Executions.Dispatcher,
        Ema.Intents.Populator,
        Ema.Intelligence.TrustScorer,
        Ema.Intelligence.VmMonitor,
        Ema.Intelligence.CostForecaster,
        Ema.Intelligence.SessionMemoryWatcher,
        Ema.Intelligence.GapScanner,
        Ema.Intelligence.ContextIndexer,
        Ema.Intelligence.AgentSupervisor,
        Ema.Intelligence.AutonomyConfig,
        Ema.Intelligence.UCBRouter,
        {Ema.Intelligence.PromptVariantStore, []},
        Ema.Intelligence.VaultLearner,
        # Projects — per-project worker registry and DynamicSupervisor for context caching
        {Registry, keys: :unique, name: Ema.Projects.WorkerRegistry},
        {DynamicSupervisor, name: Ema.Projects.ProjectWorkerSupervisor, strategy: :one_for_one},
        # CLI Manager — process registry and supervisor for session runners
        {Registry, keys: :unique, name: Ema.CliManager.Registry},
        {DynamicSupervisor, name: Ema.CliManager.RunnerSupervisor, strategy: :one_for_one}
      ] ++
        maybe_start_babysitter() ++
        maybe_start_session_store() ++
        maybe_start_campaign_manager() ++
        maybe_start_quality() ++
        maybe_start_orchestration() ++
        maybe_start_bridge() ++
        maybe_start_claude_sessions() ++
        maybe_start_cluster() ++
        maybe_start_canvas() ++
        maybe_start_superman() ++
        maybe_start_second_brain() ++
        maybe_start_responsibilities() ++
        maybe_start_vectors() ++
        maybe_start_proposal_engine() ++
        maybe_start_metamind() ++
        maybe_start_evolution() ++
        maybe_start_voice() ++
        maybe_start_git_watcher() ++
        maybe_start_harvesters() ++
        maybe_start_intention_farmer() ++
        maybe_start_temporal() ++
        maybe_start_mcp() ++
        [
          # Start to serve requests, typically the last entry
          EmaWeb.Endpoint
        ]

    # Initialize plugin registry, hooks, and session orchestrator table
    :ok = Ema.PluginRegistry.init()
    :ok = Ema.Hooks.init()
    :ok = Ema.Sessions.Orchestrator.init_table()

    # Install fuse circuit breakers (safe if fuse not yet loaded)
    try do
      Ema.Intelligence.BudgetEnforcer.install()
    rescue
      _ -> :ok
    end

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Ema.Supervisor]
    result = Supervisor.start_link(children, opts)

    case result do
      {:ok, _pid} ->
        unless test_env?() do
          Task.start(fn ->
            Process.sleep(200)
            Ema.Agents.Supervisor.start_active_agents()
          end)

          maybe_run_startup_bootstrap()
        end

      _ ->
        :ok
    end

    # Populate SecondBrain FTS index on every boot (async, non-blocking)
    if Application.get_env(:ema, :start_second_brain, true) do
      Task.start(fn ->
        Process.sleep(3_000)
        Ema.SecondBrain.Indexer.reindex_all()
      end)
    end

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

  defp test_env? do
    Code.ensure_loaded?(Mix) and function_exported?(Mix, :env, 0) and Mix.env() == :test
  end

  defp maybe_start_session_store do
    if Application.get_env(:ema, :start_session_store, true) do
      [Ema.Persistence.SessionStore]
    else
      []
    end
  end

  defp maybe_start_babysitter do
    if System.get_env("EMA_MCP_STDIO") in ["1", "true", "TRUE"] do
      []
    else
      [Ema.Babysitter.Supervisor]
    end
  end

  defp maybe_start_campaign_manager do
    if Application.get_env(:ema, :start_campaign_manager, true) do
      [Ema.Campaigns.CampaignManager]
    else
      []
    end
  end

  defp maybe_start_bridge do
    if Application.get_env(:ema, :ai_backend) == :bridge do
      [
        Ema.Claude.BridgeSupervisor,
        {DynamicSupervisor, name: Ema.Claude.ExecutionSupervisor, strategy: :one_for_one}
      ]
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

  defp maybe_start_superman do
    if Application.get_env(:ema, :start_second_brain, true) do
      [Ema.Superman.Supervisor]
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
      [Ema.Voice.Supervisor, Ema.Discord.Bridge]
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

  defp maybe_start_evolution do
    if Application.get_env(:ema, :evolution_engine, true) do
      [Ema.Evolution.Supervisor]
    else
      []
    end
  end

  defp maybe_start_intention_farmer do
    if Application.get_env(:ema, :start_intention_farmer, true) do
      [Ema.IntentionFarmer.Supervisor]
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

  defp maybe_start_cluster do
    if Application.get_env(:ema, :start_cluster, false) do
      [Ema.Claude.NodeCoordinator]
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

  defp maybe_run_startup_bootstrap do
    if Application.get_env(:ema, :start_startup_bootstrap, true) and
         System.get_env("EMA_MCP_STDIO") not in ["1", "true", "TRUE"] do
      Ema.IntentionFarmer.StartupBootstrap.run_async()
    end
  end
end
