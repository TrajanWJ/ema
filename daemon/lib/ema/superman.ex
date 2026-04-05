defmodule Ema.Superman do
  @moduledoc """
  Public API for the Superman project intelligence runtime.

  context_for/1 has two modes:
    - If the KnowledgeGraph has nodes for the project, returns those (runtime graph).
    - Week 7 fallback: if graph is empty, delegates to Superman.Fallback which reads
      a .superman file from vault or assembles context from DB.
  """

  alias Ema.Memory.ContextAssembler
  alias Ema.Projects
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

  @doc """
  Returns a structured, project-scoped context bundle for execution/UI consumers.

  This keeps the legacy mixed list-or-string contract intact on context_for/1 while
  exposing a stable shape for newer callers.
  """
  def context_bundle_for(project_ref, opts \\ []) when is_binary(project_ref) do
    with {:ok, project} <- resolve_project(project_ref) do
      graph_nodes = fetch_graph_nodes(project, project_ref)
      assembled_result = fetch_assembled_context(project, opts)
      build_bundle(project, graph_nodes, assembled_result)
    end
  end

  def context_bundle_for(_, _opts), do: {:error, :invalid_project_id}

  defp resolve_project(project_ref) do
    case Projects.get_project(project_ref) || Projects.get_project_by_slug(project_ref) do
      nil -> {:error, :not_found}
      project -> {:ok, project}
    end
  end

  defp fetch_graph_nodes(project, project_ref) do
    [project.id, project.slug, project_ref]
    |> Enum.filter(&(is_binary(&1) and &1 != ""))
    |> Enum.uniq()
    |> Enum.find_value([], fn key ->
      case KnowledgeGraph.context_for(key) do
        [] -> nil
        nodes when is_list(nodes) -> nodes
      end
    end)
  end

  defp fetch_assembled_context(project, opts) do
    case ContextAssembler.context_for(project.id, opts) do
      {:ok, assembled} = ok -> ok
      {:error, _} -> ContextAssembler.context_for(project.slug, opts)
    end
  rescue
    e -> {:error, {:assembler_failed, Exception.message(e)}}
  end

  defp build_bundle(project, graph_nodes, {:ok, assembled}) when is_list(graph_nodes) and graph_nodes != [] do
    {:ok,
     %{
       project_id: project.id,
       project_slug: project.slug,
       format: :structured,
       source: :graph,
       graph_nodes: graph_nodes,
       assembled_context: assembled,
       prompt_text: ContextAssembler.to_prompt(assembled),
       metadata: %{
         graph_node_count: length(graph_nodes),
         assembled_at: assembled.assembled_at,
         fallback_source: nil
       }
     }}
  end

  defp build_bundle(project, [], {:ok, assembled}) do
    {:ok,
     %{
       project_id: project.id,
       project_slug: project.slug,
       format: :structured,
       source: :assembler,
       graph_nodes: [],
       assembled_context: assembled,
       prompt_text: ContextAssembler.to_prompt(assembled),
       metadata: %{
         graph_node_count: 0,
         assembled_at: assembled.assembled_at,
         fallback_source: nil
       }
     }}
  end

  defp build_bundle(project, graph_nodes, {:error, _reason}) do
    case Fallback.context_for(project) do
      {:ok, content, source} ->
        {:ok,
         %{
           project_id: project.id,
           project_slug: project.slug,
           format: :structured,
           source: normalize_source(source),
           graph_nodes: graph_nodes || [],
           assembled_context: nil,
           prompt_text: content,
           metadata: %{
             graph_node_count: length(graph_nodes || []),
             assembled_at: nil,
             fallback_source: source
           }
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp normalize_source(:file), do: :fallback_file
  defp normalize_source(:db), do: :fallback_db
  defp normalize_source(other), do: other
end
