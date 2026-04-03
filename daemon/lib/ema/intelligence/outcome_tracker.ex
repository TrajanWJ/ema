defmodule Ema.Intelligence.OutcomeTracker do
  @moduledoc """
  Records every agent task outcome for performance and fitness tracking.
  Stub — full implementation in Week 11-12 of the agent integration roadmap.
  """

  use GenServer
  require Logger

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Logger.info("[Intelligence.OutcomeTracker] started (stub)")
    {:ok, %{}}
  end
end
