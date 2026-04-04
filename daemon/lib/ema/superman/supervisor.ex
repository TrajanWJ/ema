defmodule Ema.Superman.Supervisor do
  @moduledoc """
  Supervisor for the Superman runtime.

  Starts the in-memory knowledge graph used by vault watcher integrations and
  execution-time prompt enrichment.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Supervisor.init(
      [
        Ema.Superman.KnowledgeGraph
      ],
      strategy: :one_for_one
    )
  end
end
