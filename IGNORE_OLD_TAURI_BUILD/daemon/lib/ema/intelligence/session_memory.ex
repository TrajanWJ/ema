defmodule Ema.Intelligence.SessionMemory do
  @moduledoc """
  Session Memory — watches Claude sessions, extracts memory fragments (decisions,
  insights, code changes, blockers), and provides context injection for new sessions.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Intelligence.MemoryFragment
  alias Ema.ClaudeSessions.ClaudeSession

  # ── Sessions ──

  def list_sessions(opts \\ []) do
    query =
      ClaudeSession
      |> order_by(desc: :last_active)

    query =
      case Keyword.get(opts, :project_path) do
        nil -> query
        path -> where(query, [s], s.project_path == ^path)
      end

    query =
      case Keyword.get(opts, :limit) do
        nil -> query
        n -> limit(query, ^n)
      end

    Repo.all(query)
  end

  def get_session(id), do: Repo.get(ClaudeSession, id)

  def session_stats do
    total = Repo.aggregate(ClaudeSession, :count)
    total_tokens = Repo.aggregate(ClaudeSession, :sum, :token_count) || 0

    most_active =
      ClaudeSession
      |> group_by(:project_path)
      |> select([s], %{project_path: s.project_path, count: count(s.id)})
      |> order_by([s], desc: count(s.id))
      |> limit(1)
      |> Repo.one()

    %{
      total_sessions: total,
      total_tokens: total_tokens,
      most_active_project: most_active
    }
  end

  # ── Fragments ──

  def list_fragments(opts \\ []) do
    query =
      MemoryFragment
      |> order_by(desc: :importance_score)

    query =
      case Keyword.get(opts, :session_id) do
        nil -> query
        id -> where(query, [f], f.session_id == ^id)
      end

    query =
      case Keyword.get(opts, :project_path) do
        nil -> query
        path -> where(query, [f], f.project_path == ^path)
      end

    query =
      case Keyword.get(opts, :fragment_type) do
        nil -> query
        type -> where(query, [f], f.fragment_type == ^type)
      end

    query =
      case Keyword.get(opts, :limit) do
        nil -> query
        n -> limit(query, ^n)
      end

    Repo.all(query)
  end

  def create_fragment(attrs) do
    id = generate_id("mf")

    %MemoryFragment{}
    |> MemoryFragment.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def delete_fragment(id) do
    case Repo.get(MemoryFragment, id) do
      nil -> {:error, :not_found}
      fragment -> Repo.delete(fragment)
    end
  end

  def extract_fragments_for_session(session_id) do
    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      session ->
        fragments = build_fragments_from_session(session)

        created =
          Enum.map(fragments, fn attrs ->
            {:ok, f} = create_fragment(attrs)
            f
          end)

        {:ok, created}
    end
  end

  def context_for_project(project_path, limit \\ 20) do
    fragments = list_fragments(project_path: project_path, limit: limit)

    context =
      fragments
      |> Enum.group_by(& &1.fragment_type)
      |> Enum.map(fn {type, frags} ->
        items = Enum.map_join(frags, "\n", fn f -> "- #{f.content}" end)
        "## #{String.capitalize(type)}s\n#{items}"
      end)
      |> Enum.join("\n\n")

    %{
      project_path: project_path,
      fragment_count: length(fragments),
      context: context
    }
  end

  # ── Search ──

  def search_sessions(query_str) do
    like = "%#{query_str}%"

    ClaudeSession
    |> where([s], like(s.summary, ^like) or like(s.project_path, ^like))
    |> order_by(desc: :last_active)
    |> limit(50)
    |> Repo.all()
  end

  # ── Private ──

  defp build_fragments_from_session(session) do
    base = %{
      session_id: session.id,
      project_path: session.project_path
    }

    fragments = []

    fragments =
      if session.summary && String.length(session.summary) > 10 do
        [
          Map.merge(base, %{
            fragment_type: "insight",
            content: session.summary,
            importance_score: 0.6
          })
          | fragments
        ]
      else
        fragments
      end

    fragments =
      if session.token_count && session.token_count > 50_000 do
        content = "Large session (#{session.token_count} tokens) on #{session.project_path}"

        [
          Map.merge(base, %{fragment_type: "insight", content: content, importance_score: 0.4})
          | fragments
        ]
      else
        fragments
      end

    fragments
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
