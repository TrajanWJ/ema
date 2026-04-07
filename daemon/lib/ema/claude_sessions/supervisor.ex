defmodule Ema.ClaudeSessions.Supervisor do
  @moduledoc """
  Supervisor for Claude session tracking processes.
  Starts SessionWatcher (file monitoring) and SessionMonitor (process detection).
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.ClaudeSessions.SessionWatcher,
      Ema.ClaudeSessions.SessionMonitor,
      Ema.ClaudeSessions.SessionManager,
      Ema.Sessions.Checkpointer,
      Ema.Sessions.DeathHandler
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
