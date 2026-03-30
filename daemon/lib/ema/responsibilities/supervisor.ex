defmodule Ema.Responsibilities.Supervisor do
  @moduledoc """
  Supervisor for responsibility-related OTP processes.
  Disabled in test environment via application config.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.Responsibilities.Scheduler,
      Ema.Responsibilities.HealthCalculator
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
