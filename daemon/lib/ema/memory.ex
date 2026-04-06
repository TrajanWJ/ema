defmodule Ema.Memory do
  @moduledoc """
  EMA-native memory system, inspired by Honcho's Pay concept.

  Honcho Pay defines three memory layers:
    1. User memory — persistent facts about a user's preferences and patterns
    2. Session memory — working context captured within a session
    3. Message memory — individual message-level observations

  EMA.Memory implements layers 1 and 2, with cross-pollination:
  learnings from one project can inform other projects.

  Architecture:
    - UserFact: persistent, keyed preference/pattern store per user
    - SessionEntry: ephemeral working context per session
    - CrossPollination: log of learnings moved across projects

  Initial scope (Week 7): write + read. No semantic search.
  Week 8: add importance decay, EMA-driven inference, pattern extraction.

  ## Usage

      # Write a user-level preference
      Ema.Memory.set_user_fact("trajan", "avoid_billing_code", "billing module is out of scope for agents",
        category: :constraint, project_slug: "studio-kamel")

      # Read relevant facts for a dispatch
      Ema.Memory.user_facts_for("trajan", project_slug: "studio-kamel")

      # Write session working memory
      Ema.Memory.add_session_entry("session_abc", "decided to use incremental migration", kind: :decision)

      # Cross-pollinate a fact to another project
      Ema.Memory.cross_pollinate("fact_123", source: "studio-kamel", target: "ferrisses-wheel")
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Memory.{UserFact, SessionEntry, CrossPollination}

  require Logger

  # ---------------------------------------------------------------------------
  # User-level memory
  # ---------------------------------------------------------------------------

  @doc """
  Write or update a user-level fact.
  If a fact with the same user_id + key exists, it is updated in place.
  """
  def set_user_fact(user_id \\ "trajan", key, value, opts \\ []) do
    attrs = %{
      id: existing_id_or_new("uf"),
      user_id: user_id,
      key: key,
      value: value,
      category: to_string(Keyword.get(opts, :category, :general)),
      weight: Keyword.get(opts, :weight, 0.5),
      source: to_string(Keyword.get(opts, :source, :manual)),
      project_slug: Keyword.get(opts, :project_slug),
      metadata: Keyword.get(opts, :metadata, %{})
    }

    case get_user_fact(user_id, key) do
      nil ->
        %UserFact{}
        |> UserFact.changeset(attrs)
        |> Repo.insert()

      existing ->
        existing
        |> UserFact.changeset(attrs)
        |> Repo.update()
    end
  end

  @doc "Get a single user fact by key."
  def get_user_fact(user_id \\ "trajan", key) do
    Repo.get_by(UserFact, user_id: user_id, key: key)
  end

  @doc """
  List user facts. Options:
    - :user_id — default "trajan"
    - :category — filter by category
    - :project_slug — filter to project-specific facts (also returns general facts)
    - :min_weight — minimum importance weight
    - :limit — max results (default: 50)
  """
  def user_facts_for(user_id \\ "trajan", opts \\ []) do
    query =
      UserFact
      |> where([f], f.user_id == ^user_id)
      |> order_by([f], desc: f.weight)

    query =
      case Keyword.get(opts, :category) do
        nil -> query
        cat -> where(query, [f], f.category == ^to_string(cat))
      end

    query =
      case Keyword.get(opts, :project_slug) do
        nil -> query
        slug -> where(query, [f], f.project_slug == ^slug or is_nil(f.project_slug))
      end

    query =
      case Keyword.get(opts, :min_weight) do
        nil -> query
        w -> where(query, [f], f.weight >= ^w)
      end

    query =
      query |> limit(^Keyword.get(opts, :limit, 50))

    Repo.all(query)
  end

  @doc "Delete a user fact by key."
  def delete_user_fact(user_id \\ "trajan", key) do
    case get_user_fact(user_id, key) do
      nil -> {:error, :not_found}
      fact -> Repo.delete(fact)
    end
  end

  # ---------------------------------------------------------------------------
  # Session-level memory
  # ---------------------------------------------------------------------------

  @doc """
  Add an entry to session working memory.

  Options:
    - :kind — :context | :decision | :insight | :blocker | :outcome | :code_change
    - :user_id — default "trajan"
    - :project_slug — optional project scope
    - :weight — importance (0.0–1.0, default 0.5)
    - :metadata — extra map
  """
  def add_session_entry(session_id, content, opts \\ []) do
    attrs = %{
      id: generate_id("se"),
      session_id: session_id,
      user_id: Keyword.get(opts, :user_id, "trajan"),
      project_slug: Keyword.get(opts, :project_slug),
      kind: to_string(Keyword.get(opts, :kind, :context)),
      content: content,
      weight: Keyword.get(opts, :weight, 0.5),
      metadata: Keyword.get(opts, :metadata, %{})
    }

    %SessionEntry{}
    |> SessionEntry.changeset(attrs)
    |> Repo.insert()
  end

  @doc "List entries for a session."
  def session_entries(session_id, opts \\ []) do
    SessionEntry
    |> where([e], e.session_id == ^session_id)
    |> maybe_filter_kind(Keyword.get(opts, :kind))
    |> order_by([e], desc: e.weight)
    |> limit(^Keyword.get(opts, :limit, 100))
    |> Repo.all()
  end

  @doc """
  Get working context for a new session — pulls recent session outcomes and
  high-weight user facts for the given project.

  This is the EMA equivalent of Honcho's pre-dispatch peer representation query.
  """
  def context_for(project_slug, user_id \\ "trajan", opts \\ []) do
    facts = user_facts_for(user_id, project_slug: project_slug, min_weight: 0.4, limit: 20)

    # Last N outcomes from recent sessions for this project
    recent_outcomes =
      SessionEntry
      |> where(
        [e],
        e.project_slug == ^project_slug and e.kind in ["outcome", "decision", "insight"]
      )
      |> order_by([e], desc: e.inserted_at)
      |> limit(^Keyword.get(opts, :recent_outcomes, 5))
      |> Repo.all()

    cross_pollinated =
      CrossPollination
      |> where([cp], cp.target_project_slug == ^project_slug)
      |> order_by([cp], desc: cp.applied_at)
      |> limit(10)
      |> Repo.all()
      |> Enum.map(fn cp ->
        fact = Repo.get(UserFact, cp.fact_id)
        %{pollination: cp, fact: fact}
      end)
      |> Enum.filter(fn %{fact: f} -> f != nil end)

    %{
      user_facts: facts,
      recent_outcomes: recent_outcomes,
      cross_pollinated: cross_pollinated
    }
  end

  # ---------------------------------------------------------------------------
  # Cross-pollination
  # ---------------------------------------------------------------------------

  @doc """
  Copy a user-level fact from a source project's context to a target project.
  Records the transfer in the cross_pollinations table.

  This implements Honcho's cross-context learning: a pattern learned in
  StudioKamel (e.g. "avoid billing module") can be surfaced when working
  on a related project.
  """
  def cross_pollinate(fact_id, opts) do
    source = Keyword.fetch!(opts, :source)
    target = Keyword.fetch!(opts, :target)
    rationale = Keyword.get(opts, :rationale, "")

    case Repo.get(UserFact, fact_id) do
      nil ->
        {:error, :fact_not_found}

      _fact ->
        attrs = %{
          id: generate_id("cp"),
          source_project_slug: source,
          target_project_slug: target,
          fact_id: fact_id,
          rationale: rationale,
          applied_at: DateTime.utc_now() |> DateTime.truncate(:second)
        }

        %CrossPollination{}
        |> CrossPollination.changeset(attrs)
        |> Repo.insert()
    end
  end

  @doc "List cross-pollinations for a target project."
  def cross_pollinations_for(project_slug) do
    CrossPollination
    |> where([cp], cp.target_project_slug == ^project_slug)
    |> order_by([cp], desc: cp.applied_at)
    |> Repo.all()
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp generate_id(prefix) do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{ts}_#{rand}"
  end

  defp existing_id_or_new(prefix) do
    generate_id(prefix)
  end

  defp maybe_filter_kind(query, nil), do: query
  defp maybe_filter_kind(query, kind), do: where(query, [e], e.kind == ^to_string(kind))
end
