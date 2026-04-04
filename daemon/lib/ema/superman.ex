defmodule Ema.Superman do
  @moduledoc """
  Public API for the Superman project intelligence runtime.

  context_for/1 has two modes:
    - If the KnowledgeGraph has nodes for the project, returns those (runtime graph).
    - Week 7 fallback: if graph is empty, delegates to Superman.Fallback which reads
      a .superman file from vault or assembles context from DB.
  """

  alias Ema.Superman.{KnowledgeGraph, Fallback}

  defdelegate ingest(nodes, project_id), to: KnowledgeGraph
  defdelegate clear(project_id), to: KnowledgeGraph

  @doc """
  Returns context for a project.

  Checks the in-memory KnowledgeGraph first. If no nodes are found,
  falls back to Superman.Fallback (file-based or DB-assembled).

  Returns:
    - {:ok, nodes_list} when graph has data (list of node maps)
    - {:ok, context_string} when using fallback (binary string)
    - {:error, :not_found} if project_id doesn't exist
  """
  def context_for(project_id) when is_binary(project_id) do
    case KnowledgeGraph.context_for(project_id) do
      [] ->
        # No graph data — use Week 7 fallback
        Fallback.context_for(project_id)
        |> case do
          {:ok, content, _source} -> {:ok, content}
          {:error, _} = err -> err
          other -> other
        end

      nodes when is_list(nodes) ->
        {:ok, nodes}
    end
  end

  def context_for(_), do: {:error, :invalid_project_id}

  @doc """
  Returns context with source metadata. Useful for the API endpoint.

  Returns {:ok, context, source} where source is :graph | :file | :db | :error
  """
  def context_for_with_source(project_id) when is_binary(project_id) do
    case KnowledgeGraph.context_for(project_id) do
      [] ->
        case Fallback.context_for(project_id) do
          {:ok, content, source} -> {:ok, content, source}
          {:error, reason} -> {:error, reason}
        end

      nodes when is_list(nodes) ->
        {:ok, nodes, :graph}
    end
  end

  def context_for_with_source(_), do: {:error, :invalid_project_id}
end
