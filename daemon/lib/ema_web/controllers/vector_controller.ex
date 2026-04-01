defmodule EmaWeb.VectorController do
  use EmaWeb, :controller

  alias Ema.Vectors.{Embedder, Index}

  action_fallback EmaWeb.FallbackController

  def status(conn, _params) do
    case GenServer.whereis(Index) do
      nil ->
        json(conn, %{status: "offline", total_entries: 0, projects_indexed: 0})

      _pid ->
        stats = Index.stats()

        json(conn, %{
          status: "ok",
          total_entries: stats.total_entries,
          projects_indexed: stats.projects_indexed
        })
    end
  end

  def reindex(conn, params) do
    project_id = params["project_id"]

    if project_id do
      Embedder.scan_project(project_id)
      json(conn, %{ok: true, message: "Reindex started for project #{project_id}"})
    else
      # Trigger scan for all projects
      Ema.Projects.list_projects()
      |> Enum.each(fn project -> Embedder.scan_project(project.id) end)

      json(conn, %{ok: true, message: "Reindex started for all projects"})
    end
  end

  def query(conn, params) do
    text = params["q"] || params["text"] || ""
    k = parse_int(params["k"]) || 10
    project_id = params["project_id"]

    if String.trim(text) == "" do
      conn
      |> put_status(:bad_request)
      |> json(%{error: "missing_query", message: "Provide 'q' or 'text' parameter"})
    else
      case Embedder.embed_text(text) do
        {:ok, query_vector} ->
          opts = [k: k]
          opts = if project_id, do: Keyword.put(opts, :project_id, project_id), else: opts

          results =
            Index.nearest(query_vector, opts)
            |> Enum.map(fn {entry, similarity} ->
              %{
                path: entry[:path],
                kind: entry[:kind],
                text: truncate(entry[:text], 500),
                project_id: entry[:project_id],
                similarity: Float.round(similarity, 4)
              }
            end)

          json(conn, %{results: results, count: length(results)})

        {:error, reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{error: "embedding_failed", message: inspect(reason)})
      end
    end
  end

  # --- Helpers ---

  defp truncate(nil, _max), do: nil

  defp truncate(text, max) when is_binary(text) do
    if String.length(text) > max do
      String.slice(text, 0, max) <> "..."
    else
      text
    end
  end

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(_), do: nil
end
