defmodule Ema.Vectors.Supervisor do
  @moduledoc """
  Supervisor for the vector embedding subsystem.
  Manages the vector index and embedder processes.
  Index starts first (rest_for_one) so embedder can write to it immediately.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.Vectors.Index,
      Ema.Vectors.Embedder
    ]

    Supervisor.init(children, strategy: :rest_for_one)
  end
end
