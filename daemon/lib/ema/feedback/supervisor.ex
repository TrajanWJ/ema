defmodule Ema.Feedback.Supervisor do
  @moduledoc """
  Supervises the feedback delivery layer:
    - Registry for per-channel workers
    - DiscordDelivery DynamicSupervisor (per-channel workers)
    - FeedbackConsumer (EMA-internal subscriber → HQ dashboard events)
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      {Registry, keys: :unique, name: Ema.Feedback.DiscordDelivery.Registry},
      Ema.Feedback.DiscordDelivery,
      Ema.Feedback.Consumer
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
