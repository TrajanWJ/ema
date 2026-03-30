defmodule Ema.SecondBrain.Supervisor do
  @moduledoc """
  Supervisor for Second Brain OTP processes.
  Starts VaultWatcher, GraphBuilder, and SystemBrain.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.SecondBrain.VaultWatcher,
      Ema.SecondBrain.GraphBuilder,
      Ema.SecondBrain.SystemBrain
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
