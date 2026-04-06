defmodule Ema.IntentionFarmer.Supervisor do
  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      {Task.Supervisor, name: Ema.IntentionFarmer.TaskSupervisor},
      Ema.IntentionFarmer.SourceRegistry,
      Ema.IntentionFarmer.Watcher,
      Ema.IntentionFarmer.BacklogFarmer
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
