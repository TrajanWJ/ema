defmodule Ema.Superman do
  @moduledoc """
  Public API for the Superman project intelligence runtime.
  """

  alias Ema.Superman.KnowledgeGraph

  defdelegate ingest(nodes, project_id), to: KnowledgeGraph
  defdelegate context_for(project_id), to: KnowledgeGraph
  defdelegate clear(project_id), to: KnowledgeGraph
end
