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
        Ema.Agents.Supervisor,
        # Pipes — workflow automation (Registry -> Loader -> Executor)
        Ema.Pipes.Supervisor
      ] ++
        maybe_start_bridge() ++
        maybe_start_claude_sessions() ++
        maybe_start_canvas() ++
        maybe_start_second_brain() ++
        maybe_start_responsibilities() ++
        maybe_start_vectors() ++
        maybe_start_proposal_engine() ++
        maybe_start_metamind() ++
        [
          # Start to serve requests, typically the last entry
          EmaWeb.Endpoint
        ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Ema.Supervisor]
    Supervisor.start_link(children, opts)
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
end
