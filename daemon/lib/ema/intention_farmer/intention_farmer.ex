defmodule Ema.IntentionFarmer do
  @moduledoc """
  Context for harvesting intents from Claude Code and Codex CLI sessions.
  Parses session files, extracts user intents, and tracks them for loading
  into the brain dump inbox.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.IntentionFarmer.{HarvestedSession, HarvestedIntent}

  # --- Sessions ---

  @doc """
  List harvested sessions with optional filters.

  Options:
    - :source_type - filter by source_type ("claude_code" | "codex_cli")
    - :status - filter by status
    - :project_id - filter by project
    - :limit - max results (default 100)
  """
  def list_sessions(opts \\ []) do
    HarvestedSession
    |> maybe_filter(:source_type, opts[:source_type])
    |> maybe_filter(:status, opts[:status])
    |> maybe_filter(:project_id, opts[:project_id])
    |> order_by(desc: :inserted_at)
    |> limit(^(opts[:limit] || 100))
    |> Repo.all()
  end

  @doc "Get a single harvested session by ID."
  def get_session(id), do: Repo.get(HarvestedSession, id)

  @doc "Get a session by its source fingerprint."
  def get_session_by_fingerprint(fingerprint) do
    Repo.get_by(HarvestedSession, source_fingerprint: fingerprint)
  end

  @doc "Create a new harvested session."
  def create_session(attrs) do
    id = attrs[:id] || attrs["id"] || generate_id("hs")

    %HarvestedSession{}
    |> HarvestedSession.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  @doc "Update an existing harvested session."
  def update_session(%HarvestedSession{} = session, attrs) do
    session
    |> HarvestedSession.changeset(attrs)
    |> Repo.update()
  end

  @doc "Check if a session with the given fingerprint already exists."
  def session_exists?(source_fingerprint) do
    HarvestedSession
    |> where([s], s.source_fingerprint == ^source_fingerprint)
    |> Repo.exists?()
  end

  # --- Intents ---

  @doc """
  List harvested intents with optional filters.

  Options:
    - :intent_type - filter by intent_type
    - :loaded - boolean filter
    - :source_type - filter by source_type
    - :harvested_session_id - filter by session
    - :limit - max results (default 100)
  """
  def list_intents(opts \\ []) do
    HarvestedIntent
    |> maybe_filter(:intent_type, opts[:intent_type])
    |> maybe_filter(:source_type, opts[:source_type])
    |> maybe_filter(:harvested_session_id, opts[:harvested_session_id])
    |> maybe_filter_loaded(opts[:loaded])
    |> order_by(desc: :inserted_at)
    |> limit(^(opts[:limit] || 100))
    |> Repo.all()
  end

  @doc "Get a single harvested intent by ID."
  def get_intent(id), do: Repo.get(HarvestedIntent, id)

  @doc "Get an intent by its source fingerprint."
  def get_intent_by_fingerprint(fingerprint) do
    Repo.get_by(HarvestedIntent, source_fingerprint: fingerprint)
  end

  @doc "Create a new harvested intent."
  def create_intent(attrs) do
    id = attrs[:id] || attrs["id"] || generate_id("hi")

    %HarvestedIntent{}
    |> HarvestedIntent.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  @doc "Update an existing harvested intent."
  def update_intent(%HarvestedIntent{} = intent, attrs) do
    intent
    |> HarvestedIntent.changeset(attrs)
    |> Repo.update()
  end

  @doc "Mark an intent as loaded into brain dump."
  def mark_intent_loaded(%HarvestedIntent{} = intent, brain_dump_item_id) do
    intent
    |> HarvestedIntent.changeset(%{loaded: true, brain_dump_item_id: brain_dump_item_id})
    |> Repo.update()
  end

  @doc "Check if an intent with the given fingerprint already exists."
  def intent_exists?(source_fingerprint) do
    HarvestedIntent
    |> where([i], i.source_fingerprint == ^source_fingerprint)
    |> Repo.exists?()
  end

  # --- Stats ---

  @doc "Return aggregate stats for the intention farmer."
  def stats do
    total_sessions = Repo.aggregate(HarvestedSession, :count)
    total_intents = Repo.aggregate(HarvestedIntent, :count)

    unloaded_intents =
      HarvestedIntent
      |> where([i], i.loaded == false)
      |> Repo.aggregate(:count)

    by_source =
      HarvestedSession
      |> group_by([s], s.source_type)
      |> select([s], {s.source_type, count(s.id)})
      |> Repo.all()
      |> Map.new()

    %{
      total_sessions: total_sessions,
      total_intents: total_intents,
      unloaded_intents: unloaded_intents,
      by_source: by_source
    }
  end

  # --- Private Helpers ---

  defp maybe_filter(query, _field, nil), do: query

  defp maybe_filter(query, :source_type, value) do
    where(query, [q], q.source_type == ^value)
  end

  defp maybe_filter(query, :status, value) do
    where(query, [q], q.status == ^value)
  end

  defp maybe_filter(query, :project_id, value) do
    where(query, [q], q.project_id == ^value)
  end

  defp maybe_filter(query, :intent_type, value) do
    where(query, [q], q.intent_type == ^value)
  end

  defp maybe_filter(query, :harvested_session_id, value) do
    where(query, [q], q.harvested_session_id == ^value)
  end

  defp maybe_filter_loaded(query, nil), do: query

  defp maybe_filter_loaded(query, loaded) when is_boolean(loaded) do
    where(query, [i], i.loaded == ^loaded)
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
