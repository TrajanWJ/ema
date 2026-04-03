defmodule Ema.Canvas.Supervisor do
  use Supervisor

  def start_link(opts) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.Canvas.DataRefresher
    ]

    # Seed stock templates after a short delay so Repo is ready
    Task.start(fn ->
      Process.sleep(1_000)
      Ema.Canvases.seed_stock_templates()
    end)

    Supervisor.init(children, strategy: :one_for_one)
  end
end
