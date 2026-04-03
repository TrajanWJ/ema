defmodule Ema.Harvesters.Supervisor do
  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children =
      if Application.get_env(:ema, :harvesters_workers, true) do
        [
          {Task.Supervisor, name: Ema.Harvesters.TaskSupervisor},
          Ema.Harvesters.GitHarvester,
          Ema.Harvesters.SessionHarvester
        ]
      else
        [{Task.Supervisor, name: Ema.Harvesters.TaskSupervisor}]
      end

    Supervisor.init(children, strategy: :one_for_one)
  end
end
