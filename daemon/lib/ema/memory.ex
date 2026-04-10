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
  alias Ema.Memory.{UserFact, SessionEntry, CrossPollination, Entry}

  require Logger

  @entry_default_types ~w(preference decision file_context error_pattern guideline)

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

  # ---------------------------------------------------------------------------
  # Sugar-style typed memory entries
  # ---------------------------------------------------------------------------
  #
  # The functions below operate on `Ema.Memory.Entry` — typed, FTS5-searchable
  # context that survives across Claude/agent sessions. They are the layer the
  # ContextManager queries on every prompt build, and the layer MCP tools
  # expose to external Claude Code sessions.

  @doc """
  Store a typed memory entry. Returns `{:ok, entry}` or `{:error, changeset}`.

  Required: `:memory_type`, `:content`.
  Optional: `:summary`, `:scope` (default "project"), `:importance` (0..1),
            `:actor_id`, `:project_id`, `:space_id`, `:source_id`,
            `:metadata`, `:expires_at`.

  If `:summary` is omitted and content is longer than 100 chars, the first
  100 chars are used as the summary (matches Sugar behaviour).
  """
  def store_entry(attrs) when is_map(attrs) do
    attrs =
      attrs
      |> stringify_keys()
      |> Map.put_new("id", generate_id("mem"))
      |> Map.put_new("scope", "project")
      |> ensure_summary()

    %Entry{}
    |> Entry.changeset(attrs)
    |> Repo.insert()
  end

  def store_entry(memory_type, content, opts) when is_binary(content) do
    attrs =
      opts
      |> Map.new()
      |> Map.put(:memory_type, to_string(memory_type))
      |> Map.put(:content, content)

    store_entry(attrs)
  end

  @doc "Fetch a single entry by id."
  def get_entry(id), do: Repo.get(Entry, id)

  @doc "Delete an entry by id."
  def delete_entry(id) do
    case get_entry(id) do
      nil -> {:error, :not_found}
      entry -> Repo.delete(entry)
    end
  end

  @doc "Update the importance weight on an entry (clamped to 0..1)."
  def update_importance(id, weight) when is_number(weight) do
    clamped = weight |> max(0.0) |> min(1.0)

    case get_entry(id) do
      nil ->
        {:error, :not_found}

      entry ->
        entry
        |> Entry.changeset(%{importance: clamped})
        |> Repo.update()
    end
  end

  @doc """
  Increment the access counter and stamp `last_accessed_at`.
  Called by retrievers so hot entries surface first.
  """
  def touch(id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {n, _} =
      Entry
      |> where([e], e.id == ^id)
      |> update(
        inc: [access_count: 1],
        set: [last_accessed_at: ^now]
      )
      |> Repo.update_all([])

    if n > 0, do: :ok, else: {:error, :not_found}
  end

  @doc """
  List recent entries, optionally filtered by type / scope / actor / project.

  Options:
    - `:limit` (default 50)
    - `:memory_type` — filter to one type
    - `:scope` — filter to one scope
    - `:actor_id`, `:project_id`, `:space_id`
    - `:since_days` — only entries inserted within the last N days
  """
  def list_recent_entries(opts \\ []) do
    Entry
    |> filter_entries(opts)
    |> order_by([e], desc: e.importance, desc: e.inserted_at)
    |> limit(^Keyword.get(opts, :limit, 50))
    |> Repo.all()
  end

  @doc """
  FTS5 keyword search across `content` and `summary`.

  Ports Sugar's query expansion: tokenises the query, applies a `*` prefix
  to each term, and adds simple English stem variants for plurals so that
  `companies` matches `company`, `trademarks` matches `trademark`, etc.
  Terms are joined with `OR` for recall.

  Falls back to a `LIKE` scan if FTS5 is unavailable or rejects the query.
  Returns a list of `{entry, score}` tuples sorted by relevance.
  """
  def search_entries(query, opts \\ []) when is_binary(query) do
    limit = Keyword.get(opts, :limit, 10)
    fts_query = build_fts_query(query)

    case fts_search(fts_query, opts, limit) do
      {:ok, results} when results != [] ->
        Enum.each(results, fn {entry, _score} -> touch(entry.id) end)
        results

      _ ->
        results = like_search(query, opts, limit)
        Enum.each(results, fn {entry, _score} -> touch(entry.id) end)
        results
    end
  end

  @doc """
  Recall — same as `search_entries/2` but returns formatted markdown
  ready to be injected into a Claude prompt. Returns "" when nothing
  matches.
  """
  def recall(query, opts \\ []) when is_binary(query) do
    results = search_entries(query, opts)
    format_for_prompt(results, Keyword.get(opts, :max_tokens, 1500))
  end

  @doc """
  Build the standard context bundle for an actor — what every agent gets
  injected on every Claude call.

  Returns a map with `:preferences`, `:recent_decisions`, `:file_context`,
  `:error_patterns`, `:guidelines` (each a list of `Entry` structs).

  Options:
    - `:project_id` — narrow context to one project (preferences and
      guidelines still cross projects)
    - `:limit` — per-section limit (default 10)
  """
  def get_context(actor_id \\ nil, opts \\ []) do
    limit = Keyword.get(opts, :limit, 10)
    project_id = Keyword.get(opts, :project_id)

    %{
      preferences: by_type(:preference, limit: 20, actor_id: actor_id),
      recent_decisions:
        by_type(:decision,
          limit: limit,
          since_days: 30,
          actor_id: actor_id,
          project_id: project_id
        ),
      file_context:
        by_type(:file_context, limit: limit, actor_id: actor_id, project_id: project_id),
      error_patterns:
        by_type(:error_pattern,
          limit: 5,
          since_days: 60,
          actor_id: actor_id,
          project_id: project_id
        ),
      guidelines: by_type(:guideline, limit: limit)
    }
  end

  @doc """
  Format `get_context/2` output as a markdown block ready for prompt
  injection. Respects `max_tokens` (chars / 4) so that an oversized
  context never blows the prompt budget.
  """
  def format_context_for_prompt(context, max_tokens \\ 2000) when is_map(context) do
    sections = [
      {"Preferences", context[:preferences] || []},
      {"Guidelines", context[:guidelines] || []},
      {"Recent Decisions", context[:recent_decisions] || []},
      {"File Context", context[:file_context] || []},
      {"Error Patterns", context[:error_patterns] || []}
    ]

    body =
      sections
      |> Enum.reject(fn {_label, entries} -> entries == [] end)
      |> Enum.map_join("\n\n", fn {label, entries} ->
        formatted =
          entries
          |> Enum.map(fn e ->
            line = e.summary || e.content
            "- #{line} _(#{format_age(e.inserted_at)})_"
          end)
          |> Enum.join("\n")

        "### #{label}\n#{formatted}"
      end)

    if body == "" do
      ""
    else
      header = "## Memory"
      full = "#{header}\n\n#{body}"
      truncate_to_chars(full, max_tokens * 4)
    end
  end

  defp truncate_to_chars(text, max_chars) when byte_size(text) <= max_chars, do: text
  defp truncate_to_chars(text, max_chars) do
    binary_part(text, 0, max_chars) <> "\n…[truncated]"
  end

  @doc """
  Format a list of `{entry, score}` search results as markdown for
  prompt injection. Token-budgeted via `max_tokens` (chars / 4).
  """
  def format_for_prompt(results, max_tokens \\ 1500)
  def format_for_prompt([], _), do: ""

  def format_for_prompt(results, max_tokens) do
    max_chars = max_tokens * 4
    header = "## Relevant Context from Memory\n"

    {blocks, _} =
      Enum.reduce_while(results, {[header], byte_size(header)}, fn {entry, _score},
                                                                    {acc, count} ->
        type_label = entry.memory_type |> String.replace("_", " ") |> String.capitalize()
        age = format_age(entry.inserted_at)
        block = "\n### #{type_label} (#{age})\n#{entry.content}\n"

        if count + byte_size(block) > max_chars do
          {:halt, {acc, count}}
        else
          {:cont, {[block | acc], count + byte_size(block)}}
        end
      end)

    case blocks do
      [^header] -> ""
      list -> list |> Enum.reverse() |> IO.iodata_to_binary() |> Kernel.<>("\n---\n")
    end
  end

  @doc "Prune entries past their `expires_at`. Returns the number deleted."
  def prune_expired_entries do
    now = DateTime.utc_now()

    {n, _} =
      Entry
      |> where([e], not is_nil(e.expires_at) and e.expires_at < ^now)
      |> Repo.delete_all()

    n
  end

  # ── Private: entry helpers ───────────────────────────────────────────────

  defp by_type(type, opts) do
    list_recent_entries(Keyword.put(opts, :memory_type, to_string(type)))
  end

  defp filter_entries(query, opts) do
    Enum.reduce(opts, query, fn
      {:memory_type, nil}, q ->
        q

      {:memory_type, type}, q ->
        where(q, [e], e.memory_type == ^to_string(type))

      {:scope, nil}, q ->
        q

      {:scope, scope}, q ->
        where(q, [e], e.scope == ^to_string(scope))

      {:actor_id, nil}, q ->
        q

      {:actor_id, id}, q ->
        where(q, [e], e.actor_id == ^id)

      {:project_id, nil}, q ->
        q

      {:project_id, id}, q ->
        where(q, [e], e.project_id == ^id)

      {:space_id, nil}, q ->
        q

      {:space_id, id}, q ->
        where(q, [e], e.space_id == ^id)

      {:since_days, nil}, q ->
        q

      {:since_days, days}, q when is_integer(days) ->
        cutoff = DateTime.utc_now() |> DateTime.add(-days * 86_400, :second)
        where(q, [e], e.inserted_at >= ^cutoff)

      _, q ->
        q
    end)
  end

  defp build_fts_query(raw) do
    raw
    |> String.split(~r/\s+/, trim: true)
    |> Enum.flat_map(&expand_term/1)
    |> Enum.uniq()
    |> case do
      [] -> nil
      [single] -> single
      many -> Enum.join(many, " OR ")
    end
  end

  defp expand_term(word) do
    clean =
      word
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]/u, "")

    cond do
      clean == "" or String.length(clean) < 2 ->
        []

      String.ends_with?(clean, "ies") and String.length(clean) > 4 ->
        ["#{clean}*", "#{String.slice(clean, 0..-4//1)}y*"]

      String.ends_with?(clean, "es") and String.length(clean) > 3 ->
        ["#{clean}*", "#{String.slice(clean, 0..-3//1)}*"]

      String.ends_with?(clean, "s") and String.length(clean) > 3 ->
        ["#{clean}*", "#{String.slice(clean, 0..-2//1)}*"]

      true ->
        ["#{clean}*"]
    end
  end

  defp fts_search(nil, _opts, _limit), do: {:ok, []}

  defp fts_search(fts_query, opts, limit) do
    sql = """
    SELECT e.id, bm25(memory_fts) AS score
    FROM memory_entries e
    JOIN memory_fts f ON f.rowid = e.rowid
    WHERE memory_fts MATCH ?
    ORDER BY bm25(memory_fts)
    LIMIT ?
    """

    case Ecto.Adapters.SQL.query(Repo, sql, [fts_query, limit * 4]) do
      {:ok, %{rows: rows}} ->
        ids = Enum.map(rows, fn [id, _score] -> id end)
        scores = Map.new(rows, fn [id, score] -> {id, score || 0.0} end)

        entries =
          Entry
          |> where([e], e.id in ^ids)
          |> filter_entries(opts)
          |> Repo.all()

        results =
          entries
          |> Enum.map(fn e ->
            raw = Map.get(scores, e.id, 0.0)
            normalized = min(1.0, abs(raw) / 10)
            {e, normalized}
          end)
          |> Enum.sort_by(fn {_e, score} -> -score end)
          |> Enum.take(limit)

        {:ok, results}

      {:error, reason} ->
        Logger.debug("[Memory] FTS5 search failed: #{inspect(reason)}")
        {:error, reason}
    end
  rescue
    e ->
      Logger.debug("[Memory] FTS5 raised: #{Exception.message(e)}")
      {:error, e}
  end

  defp like_search(query, opts, limit) do
    pattern = "%#{query}%"

    Entry
    |> where([e], like(e.content, ^pattern) or like(e.summary, ^pattern))
    |> filter_entries(opts)
    |> order_by([e], desc: e.importance, desc: e.inserted_at)
    |> limit(^limit)
    |> Repo.all()
    |> Enum.map(&{&1, 0.5})
  end

  defp ensure_summary(%{"summary" => s} = attrs) when is_binary(s) and s != "", do: attrs

  defp ensure_summary(%{"content" => content} = attrs) when is_binary(content) do
    if String.length(content) > 100 do
      Map.put(attrs, "summary", String.slice(content, 0, 100))
    else
      attrs
    end
  end

  defp ensure_summary(attrs), do: attrs

  defp stringify_keys(map) do
    Map.new(map, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end

  defp format_age(nil), do: "unknown"

  defp format_age(%DateTime{} = dt) do
    diff = DateTime.diff(DateTime.utc_now(), dt, :second)

    cond do
      diff < 3600 -> "just now"
      diff < 86_400 -> "#{div(diff, 3600)}h ago"
      diff < 7 * 86_400 -> "#{div(diff, 86_400)}d ago"
      diff < 30 * 86_400 -> "#{div(diff, 7 * 86_400)}w ago"
      true -> Calendar.strftime(dt, "%Y-%m-%d")
    end
  end

  defp format_age(%NaiveDateTime{} = ndt) do
    case DateTime.from_naive(ndt, "Etc/UTC") do
      {:ok, dt} -> format_age(dt)
      _ -> "unknown"
    end
  end

  @doc false
  def default_recall_types, do: @entry_default_types
end
