defmodule Ema.MetaMind.Supervisor do
  @moduledoc """
  Supervisor for the MetaMind subsystem.
  Manages interceptor, reviewer, researcher, and task supervisor.
  Uses rest_for_one: if reviewer crashes, interceptor restarts too.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      {Task.Supervisor, name: Ema.MetaMind.TaskSupervisor},
      Ema.MetaMind.Reviewer,
      Ema.MetaMind.Interceptor,
      Ema.MetaMind.Researcher
    ]

    Supervisor.init(children, strategy: :rest_for_one)
  end
end
