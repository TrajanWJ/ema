defmodule Ema.Pipes.Supervisor do
  @moduledoc """
  Supervises the Pipes OTP tree: Registry, Loader, and Executor.
  Registry starts first (provides action catalog), then Loader (seeds DB),
  then Executor (subscribes to events and runs pipes).

  In test mode, only the Registry starts (Loader and Executor need DB
  access outside the sandbox).
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children =
      if Application.get_env(:ema, :pipes_workers, true) do
        [
          Ema.Pipes.Registry,
          Ema.Pipes.Loader,
          Ema.Pipes.Executor
        ]
      else
        [Ema.Pipes.Registry]
      end

    Supervisor.init(children, strategy: :rest_for_one)
  end
end
