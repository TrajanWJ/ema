defmodule EmaWeb.GitSyncController do
  use EmaWeb, :controller

  alias Ema.Intelligence
  alias Ema.Intelligence.WikiSync

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    events =
      Intelligence.list_git_events(
        limit: parse_int(params["limit"], 50),
        repo_path: params["repo"]
      )

    json(conn, %{events: Enum.map(events, &Intelligence.serialize_event/1)})
  end

  def suggestions(conn, %{"id" => id}) do
    case Intelligence.get_git_event(id) do
      nil ->
        {:error, :not_found}

      event ->
        actions = Intelligence.list_sync_actions(event.id)
        json(conn, %{suggestions: Enum.map(actions, &Intelligence.serialize_action/1)})
    end
  end

  def apply_suggestion(conn, %{"id" => id, "action_id" => action_id}) do
    # Verify the event exists
    case Intelligence.get_git_event(id) do
      nil ->
        {:error, :not_found}

      _event ->
        case WikiSync.apply_action(action_id) do
          {:ok, action} ->
            json(conn, %{action: Intelligence.serialize_action(action)})

          {:error, :not_found} ->
            {:error, :not_found}

          {:error, reason} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: inspect(reason)})
        end
    end
  end

  def sync_status(conn, _params) do
    repos = Ema.Intelligence.GitWatcher.watched_repos()
    events = Intelligence.list_git_events(limit: 5)

    json(conn, %{
      watched_repos: repos,
      pending_suggestions: Intelligence.pending_suggestions_count(),
      stale_pages: Intelligence.stale_pages_count(),
      recent_events: Enum.map(events, &Intelligence.serialize_event/1)
    })
  end

  def scan(conn, params) do
    repo = params["repo"] || ""

    if repo != "" and File.dir?(repo) do
      Ema.Intelligence.GitWatcher.scan_repo(repo)
      json(conn, %{ok: true, message: "Scan triggered for #{repo}"})
    else
      conn
      |> put_status(:bad_request)
      |> json(%{error: "Invalid or missing repo path"})
    end
  end

  defp parse_int(nil, default), do: default
  defp parse_int(val, _default) when is_integer(val), do: val

  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> default
    end
  end
end
