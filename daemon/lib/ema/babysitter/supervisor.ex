defmodule Ema.Babysitter.Supervisor do
  @moduledoc """
  Top-level supervisor for the Babysitter system.
  Starts VisibilityHub, StreamTicker, StreamChannels, and OrgController.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.Babysitter.VisibilityHub,
      Ema.Babysitter.StreamTicker,
      Ema.Babysitter.StreamChannels,
      Ema.Babysitter.OrgController
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
