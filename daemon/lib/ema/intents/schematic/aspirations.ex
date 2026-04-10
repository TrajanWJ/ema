defmodule Ema.Intents.Schematic.Aspirations do
  @moduledoc """
  CRUD context for stacked aspirations — long-horizon wishes that haven't yet
  earned the weight of a real intent.

  Aspirations live separately from intents so the user can collect "someday"
  ideas without polluting the active intent tree. When an aspiration matures,
  `promote/2` converts it into a real `Ema.Intents.Intent` and stamps the
  aspiration with the resulting intent id.
  """

  import Ecto.Query, except: [update: 2, update: 3]

  alias Ema.Repo
  alias Ema.Intents
  alias Ema.Intents.Schematic.Aspiration
  alias Ema.Intents.Schematic.Target

  @default_status "stacked"
  @default_horizon "long"

  # ── Read ─────────────────────────────────────────────────────────

  @doc """
  List aspirations.

  Options:
    * `:scope_path` — filter by exact scope path
    * `:status` — filter by status (default `"stacked"`)
  """
  def list(opts \\ []) do
    status = Keyword.get(opts, :status, @default_status)
    scope_path = Keyword.get(opts, :scope_path)

    Aspiration
    |> maybe_where_status(status)
    |> maybe_where_scope(scope_path)
    |> order_by([a], desc: a.weight, desc: a.inserted_at)
    |> Repo.all()
  end

  def get(id), do: Repo.get(Aspiration, id)

  def get!(id), do: Repo.get!(Aspiration, id)

  @doc """
  Count stacked aspirations (optionally scoped). Used for badge counts.
  """
  def count(scope_path \\ nil) do
    Aspiration
    |> where([a], a.status == ^@default_status)
    |> maybe_where_scope(scope_path)
    |> Repo.aggregate(:count, :id)
  end

  # ── Write ────────────────────────────────────────────────────────

  @doc """
  Insert a new aspiration. Required: `:title`, `:scope_path`.
  Defaults: horizon=long, status=stacked, weight=0.
  """
  def push(attrs) do
    attrs =
      attrs
      |> normalize_keys()
      |> Map.put_new("horizon", @default_horizon)
      |> Map.put_new("status", @default_status)
      |> Map.put_new("weight", 0)

    %Aspiration{}
    |> Aspiration.changeset(attrs)
    |> Repo.insert()
  end

  @doc "Generic update by id."
  def update(id, attrs) do
    case get(id) do
      nil ->
        {:error, :not_found}

      aspiration ->
        aspiration
        |> Aspiration.changeset(normalize_keys(attrs))
        |> Repo.update()
    end
  end

  @doc "Convenience: change weight only."
  def reorder(id, new_weight) when is_integer(new_weight) do
    update(id, %{weight: new_weight})
  end

  @doc """
  Mark an aspiration as retired. Returns `{:ok, aspiration}` or `{:error, _}`.
  """
  def retire(id, _opts \\ []) do
    case get(id) do
      nil ->
        {:error, :not_found}

      aspiration ->
        aspiration
        |> Aspiration.changeset(%{"status" => "retired"})
        |> Repo.update()
    end
  end

  @doc """
  Promote a stacked aspiration into a real intent.

  Steps:
    1. Fetch aspiration; bail if not stacked.
    2. Resolve the scope path to find the owning project (subproject preferred).
    3. Build intent attrs (kind=goal, level=1 or 2 if scoped to a project).
    4. Insert the intent and stamp the aspiration.

  Returns `{:ok, %{aspiration: a, intent: i}}` on success.
  """
  def promote(id, _opts \\ []) do
    Repo.transaction(fn ->
      with %Aspiration{} = aspiration <- get(id) || {:error, :not_found},
           :ok <- check_stacked(aspiration),
           {:ok, project_id, level} <- resolve_scope(aspiration.scope_path),
           {:ok, intent} <- create_intent_from(aspiration, project_id, level),
           {:ok, updated} <- stamp_promoted(aspiration, intent) do
        %{aspiration: updated, intent: intent}
      else
        {:error, reason} -> Repo.rollback(reason)
        nil -> Repo.rollback(:not_found)
      end
    end)
  end

  # ── Promote helpers ──────────────────────────────────────────────

  defp check_stacked(%Aspiration{status: "stacked"}), do: :ok
  defp check_stacked(_), do: {:error, :not_stacked}

  defp resolve_scope(nil), do: {:ok, nil, 1}
  defp resolve_scope(""), do: {:ok, nil, 1}

  defp resolve_scope(scope_path) do
    case Target.resolve(scope_path) do
      {:ok, target} ->
        project_id = target_project_id(target)
        level = if project_id, do: 2, else: 1
        {:ok, project_id, level}

      {:error, _} ->
        # Unknown scope path is non-fatal — promote at level 1 with no project.
        {:ok, nil, 1}
    end
  end

  defp target_project_id(%{subproject: %{id: id}}) when not is_nil(id), do: id
  defp target_project_id(%{project: %{id: id}}) when not is_nil(id), do: id
  defp target_project_id(_), do: nil

  defp create_intent_from(%Aspiration{} = aspiration, project_id, level) do
    attrs = %{
      title: aspiration.title,
      slug: slugify(aspiration.title),
      description: aspiration.description,
      kind: "goal",
      level: level,
      project_id: project_id,
      source_type: "manual"
    }

    Intents.create_intent(attrs)
  end

  defp stamp_promoted(%Aspiration{} = aspiration, intent) do
    aspiration
    |> Aspiration.changeset(%{
      "status" => "promoted",
      "promoted_intent_id" => intent.id
    })
    |> Repo.update()
  end

  defp slugify(nil), do: nil

  defp slugify(text) when is_binary(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.trim("-")
    |> String.slice(0, 60)
  end

  # ── Query helpers ────────────────────────────────────────────────

  defp maybe_where_status(query, nil), do: query
  defp maybe_where_status(query, status), do: where(query, [a], a.status == ^status)

  defp maybe_where_scope(query, nil), do: query
  defp maybe_where_scope(query, scope), do: where(query, [a], a.scope_path == ^scope)

  defp normalize_keys(attrs) when is_map(attrs) do
    Enum.into(attrs, %{}, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end
end
