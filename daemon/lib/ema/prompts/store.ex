defmodule Ema.Prompts.Store do
  @moduledoc """
  Context for the `prompts` table — versioned, A/B-testable runtime prompts.

  This is distinct from `Ema.Prompts` (which wraps the legacy `prompt_templates`
  table for the UI editor). `Ema.Prompts.Store` owns the new `prompts` table used
  by the daemon's AI pipeline and the `/api/projects/:id/context` endpoint.

  Hot-reload: `Ema.Prompts.Loader` keeps an ETS cache keyed by kind.
  After any write, the Loader is automatically notified.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Prompts.Prompt

  # ---------------------------------------------------------------------------
  # Reads
  # ---------------------------------------------------------------------------

  def list_prompts do
    Prompt |> order_by(desc: :inserted_at) |> Repo.all()
  end

  def list_prompts_by_kind(kind) do
    Prompt
    |> where([p], p.kind == ^kind)
    |> order_by(desc: :version)
    |> Repo.all()
  end

  @doc "Returns one prompt per kind — the highest version for each."
  def list_latest_per_kind do
    sub =
      from p in Prompt,
        group_by: p.kind,
        select: %{kind: p.kind, max_version: max(p.version)}

    from(p in Prompt,
      join: s in subquery(sub),
      on: p.kind == s.kind and p.version == s.max_version,
      order_by: p.kind
    )
    |> Repo.all()
  end

  @doc "Returns the highest-version prompt for a given kind, or nil."
  def latest_for_kind(kind) do
    Prompt
    |> where([p], p.kind == ^kind)
    |> order_by(desc: :version)
    |> limit(1)
    |> Repo.one()
  end

  @doc "Returns a specific version for a kind."
  def get_by_kind_and_version(kind, version) do
    Repo.get_by(Prompt, kind: kind, version: version)
  end

  def get_prompt(id), do: Repo.get(Prompt, id)
  def get_prompt!(id), do: Repo.get!(Prompt, id)

  # ---------------------------------------------------------------------------
  # Writes
  # ---------------------------------------------------------------------------

  @doc """
  Creates a new prompt. Caller must supply :kind, :content.
  An :id is generated if not provided. Version defaults to 1.
  """
  def create_prompt(attrs) do
    id = Map.get(attrs, :id) || Map.get(attrs, "id") || generate_id()

    %Prompt{}
    |> Prompt.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_reload_cache()
  end

  @doc """
  Creates a new version of an existing prompt for the same kind.
  Increments version by 1 from the current latest.
  """
  def create_new_version(kind, content, opts \\ []) do
    next_version =
      case latest_for_kind(kind) do
        nil -> 1
        p   -> p.version + 1
      end

    attrs = %{
      id:             generate_id(),
      kind:           kind,
      content:        content,
      version:        next_version,
      a_b_test_group: Keyword.get(opts, :a_b_test_group),
      metrics:        Keyword.get(opts, :metrics, %{})
    }

    %Prompt{}
    |> Prompt.changeset(attrs)
    |> Repo.insert()
    |> tap_reload_cache()
  end

  def update_prompt(%Prompt{} = prompt, attrs) do
    prompt
    |> Prompt.changeset(attrs)
    |> Repo.update()
    |> tap_reload_cache()
  end

  @doc "Record a metric tick. Merges into the metrics map."
  def record_metric(%Prompt{} = prompt, key, value) do
    new_metrics = Map.put(prompt.metrics || %{}, to_string(key), value)
    update_prompt(prompt, %{metrics: new_metrics})
  end

  def delete_prompt(%Prompt{} = prompt) do
    result = Repo.delete(prompt)
    maybe_reload_cache(prompt.kind)
    result
  end

  # ---------------------------------------------------------------------------
  # A/B test helpers
  # ---------------------------------------------------------------------------

  @doc "Returns all prompts for a given A/B test group."
  def list_by_ab_group(group) do
    Prompt
    |> where([p], p.a_b_test_group == ^group)
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  @doc "Picks a random prompt variant for the kind. Falls back to latest if no A/B groups."
  def pick_ab_variant(kind) do
    variants =
      Prompt
      |> where([p], p.kind == ^kind and not is_nil(p.a_b_test_group))
      |> Repo.all()

    case variants do
      []  -> latest_for_kind(kind)
      all -> Enum.random(all)
    end
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp generate_id do
    ts  = System.system_time(:millisecond) |> Integer.to_string()
    rnd = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "prompt_#{ts}_#{rnd}"
  end

  defp tap_reload_cache({:ok, %Prompt{kind: kind}} = result) do
    maybe_reload_cache(kind)
    result
  end

  defp tap_reload_cache(other), do: other

  defp maybe_reload_cache(kind) do
    if Process.whereis(Ema.Prompts.Loader) do
      Ema.Prompts.Loader.reload_kind(kind)
    end
  end
end
