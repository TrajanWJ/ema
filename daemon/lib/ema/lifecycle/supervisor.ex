defmodule Ema.Lifecycle.Supervisor do
  @moduledoc "Supervises the data lifecycle workers (Archiver + Compactor)."

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.Lifecycle.Archiver,
      Ema.Lifecycle.Compactor
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
