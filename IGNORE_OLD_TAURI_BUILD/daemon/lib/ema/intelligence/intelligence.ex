defmodule Ema.Intelligence do
  @moduledoc """
  Context module for git intelligence — tracking commits and wiki sync actions.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Intelligence.{GitEvent, WikiSyncAction}

  # ── Git Events ──

  def list_git_events(opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    repo_path = Keyword.get(opts, :repo_path)

    GitEvent
    |> maybe_filter_repo(repo_path)
    |> order_by(desc: :inserted_at)
    |> limit(^limit)
    |> preload(:sync_actions)
    |> Repo.all()
  end

  def get_git_event(id) do
    GitEvent
    |> Repo.get(id)
    |> Repo.preload(:sync_actions)
  end

  def get_git_event_by_sha(sha) do
    Repo.get_by(GitEvent, commit_sha: sha)
  end

  def create_git_event(attrs) do
    id = attrs["id"] || attrs[:id] || Ecto.UUID.generate()

    %GitEvent{}
    |> GitEvent.changeset(Map.put(attrs, "id", id))
    |> Repo.insert()
    |> tap_broadcast(:git_event_created)
  end

  # ── Sync Actions ──

  def list_sync_actions(git_event_id) do
    WikiSyncAction
    |> where([a], a.git_event_id == ^git_event_id)
    |> order_by(asc: :inserted_at)
    |> Repo.all()
  end

  def create_sync_action(attrs) do
    id = attrs["id"] || attrs[:id] || Ecto.UUID.generate()

    %WikiSyncAction{}
    |> WikiSyncAction.changeset(Map.put(attrs, "id", id))
    |> Repo.insert()
    |> tap_broadcast(:sync_action_created)
  end

  def apply_sync_action(id) do
    case Repo.get(WikiSyncAction, id) do
      nil ->
        {:error, :not_found}

      action ->
        action
        |> WikiSyncAction.changeset(%{"auto_applied" => true})
        |> Repo.update()
        |> tap_broadcast(:sync_action_applied)
    end
  end

  def pending_suggestions_count do
    WikiSyncAction
    |> where([a], a.auto_applied == false)
    |> Repo.aggregate(:count, :id)
  end

  def stale_pages_count do
    WikiSyncAction
    |> where([a], a.action_type == "flag_outdated" and a.auto_applied == false)
    |> Repo.aggregate(:count, :id)
  end

  # ── Serialization ──

  def serialize_event(%GitEvent{} = event) do
    %{
      id: event.id,
      repo_path: event.repo_path,
      commit_sha: event.commit_sha,
      author: event.author,
      message: event.message,
      changed_files: event.changed_files,
      diff_summary: event.diff_summary,
      sync_actions: serialize_actions(event.sync_actions),
      inserted_at: event.inserted_at,
      updated_at: event.updated_at
    }
  end

  def serialize_action(%WikiSyncAction{} = action) do
    %{
      id: action.id,
      git_event_id: action.git_event_id,
      action_type: action.action_type,
      wiki_path: action.wiki_path,
      suggestion: action.suggestion,
      auto_applied: action.auto_applied,
      inserted_at: action.inserted_at,
      updated_at: action.updated_at
    }
  end

  # ── Private ──

  defp serialize_actions(nil), do: []
  defp serialize_actions(%Ecto.Association.NotLoaded{}), do: []
  defp serialize_actions(actions), do: Enum.map(actions, &serialize_action/1)

  defp maybe_filter_repo(query, nil), do: query
  defp maybe_filter_repo(query, path), do: where(query, [e], e.repo_path == ^path)

  defp tap_broadcast({:ok, record} = result, event) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "git_sync", {event, record})
    result
  end

  defp tap_broadcast(error, _event), do: error
end
