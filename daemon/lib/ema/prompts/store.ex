defmodule Ema.Prompts.Store do
  @moduledoc """
  Context for the `prompts` table — versioned, A/B-testable runtime prompts.
  """

  import Ecto.Query

  alias Ema.Executions.Execution
  alias Ema.Prompts.Prompt
  alias Ema.Repo

  @variant_groups ["variant_A", "variant_B", "variant_a", "variant_b"]

  # ---------------------------------------------------------------------------
  # Reads
  # ---------------------------------------------------------------------------

  def list_prompts do
    Prompt |> order_by(desc: :inserted_at) |> Repo.all()
  end

  def list_prompts_by_kind(kind) do
    Prompt
    |> where([p], p.kind == ^kind)
    |> order_by([p], [desc: p.version, desc: p.inserted_at])
    |> Repo.all()
  end

  @doc "Returns one active control prompt per kind — the highest version for each."
  def list_latest_per_kind do
    Prompt
    |> where([p], p.status == "active" and (is_nil(p.a_b_test_group) or p.a_b_test_group == "control"))
    |> order_by([p], [asc: p.kind, desc: p.version, desc: p.inserted_at])
    |> Repo.all()
    |> Enum.uniq_by(& &1.kind)
  end

  @doc "Returns the highest-version active control prompt for a given kind, or nil."
  def latest_for_kind(kind) do
    Prompt
    |> where(
      [p],
      p.kind == ^kind and p.status == "active" and
        (is_nil(p.a_b_test_group) or p.a_b_test_group == "control")
    )
    |> order_by([p], [desc: p.version, desc: p.inserted_at])
    |> limit(1)
    |> Repo.one()
  end

  @doc "Returns a specific version for a kind."
  def get_by_kind_and_version(kind, version) do
    Repo.get_by(Prompt, kind: kind, version: version)
  end

  def get_prompt(id), do: Repo.get(Prompt, id)
  def get_prompt!(id), do: Repo.get!(Prompt, id)

  def active_control_for_kind(kind), do: latest_for_kind(kind)

  def active_variants_for_kind(kind) do
    Prompt
    |> where(
      [p],
      p.kind == ^kind and p.a_b_test_group in ^@variant_groups and p.status in ["testing", "active"]
    )
    |> order_by([p], asc: p.inserted_at)
    |> Repo.all()
  end

  def active_variants_for_prompt(prompt_id) do
    Prompt
    |> where(
      [p],
      p.status in ["testing", "active"] and p.a_b_test_group in ^@variant_groups and
        p.control_prompt_id == ^prompt_id
    )
    |> order_by([p], asc: p.inserted_at)
    |> Repo.all()
  end

  def prompts_below_success_rate(since, threshold \\ 0.8) do
    list_latest_per_kind()
    |> Enum.map(fn prompt -> {prompt, execution_metrics(prompt.id, since)} end)
    |> Enum.filter(fn {prompt, metrics} ->
      metrics.total > 0 and metrics.success_rate < threshold and active_variants_for_prompt(prompt.id) == []
    end)
    |> Enum.map(fn {prompt, metrics} ->
      %{prompt: prompt, metrics: metrics}
    end)
  end

  def active_tests do
    Prompt
    |> where([p], p.status in ["testing", "active"] and p.a_b_test_group in ^@variant_groups)
    |> order_by([p], asc: p.kind, asc: p.inserted_at)
    |> Repo.all()
    |> Enum.group_by(& &1.control_prompt_id)
    |> Enum.map(fn {control_id, variants} ->
      control = get_prompt(control_id)

      %{
        prompt_id: control_id,
        kind: control && control.kind,
        control: control,
        variants: variants
      }
    end)
  end

  # ---------------------------------------------------------------------------
  # Writes
  # ---------------------------------------------------------------------------

  @doc """
  Creates a new prompt. Caller must supply :kind, :content.
  An :id is generated if not provided. Version defaults to 1.
  """
  def create_prompt(attrs) do
    attrs = normalize_attrs(attrs)
    id = Map.get(attrs, "id") || generate_id()

    %Prompt{}
    |> Prompt.changeset(Map.put(attrs, "id", id))
    |> Repo.insert()
    |> tap_reload_cache()
  end

  @doc """
  Creates a new version of an existing prompt for the same kind.
  Increments version by 1 from the current latest.
  """
  def create_new_version(kind, content, opts \\ []) do
    attrs =
      %{
        kind: kind,
        content: content,
        version: next_version(kind),
        a_b_test_group: Keyword.get(opts, :a_b_test_group),
        status: Keyword.get(opts, :status, "active"),
        metrics: Keyword.get(opts, :metrics, %{}),
        parent_prompt_id: Keyword.get(opts, :parent_prompt_id),
        control_prompt_id: Keyword.get(opts, :control_prompt_id),
        optimizer_metadata: Keyword.get(opts, :optimizer_metadata, %{})
      }

    create_prompt(attrs)
  end

  def create_variants(%Prompt{} = control_prompt, variants, attrs \\ %{}) when is_list(variants) do
    started_at = DateTime.utc_now() |> DateTime.truncate(:second)
    extra_metadata = Map.get(attrs, :optimizer_metadata, %{})

    Enum.reduce_while(Enum.with_index(variants), {:ok, []}, fn {variant, index}, {:ok, acc} ->
      group = Enum.at(@variant_groups, index)

      variant_metadata =
        extra_metadata
        |> Map.merge(%{
          "generated_at" => DateTime.to_iso8601(started_at),
          "test_started_at" => DateTime.to_iso8601(started_at),
          "source_prompt_id" => control_prompt.id
        })
        |> maybe_put("rationale", Map.get(variant, :rationale) || Map.get(variant, "rationale"))
        |> maybe_put("variant_id", Map.get(variant, :variant_id) || Map.get(variant, "variant_id"))

      case create_new_version(
             control_prompt.kind,
             Map.get(variant, :content) || Map.get(variant, "content"),
             a_b_test_group: group,
             status: "testing",
             parent_prompt_id: control_prompt.id,
             control_prompt_id: control_prompt.id,
             optimizer_metadata: variant_metadata
           ) do
        {:ok, prompt} -> {:cont, {:ok, [prompt | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, prompts} -> {:ok, Enum.reverse(prompts)}
      error -> error
    end
  end

  def update_prompt(%Prompt{} = prompt, attrs) do
    prompt
    |> Prompt.changeset(normalize_attrs(attrs))
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

  def archive_prompt(%Prompt{} = prompt) do
    update_prompt(prompt, %{status: "archived"})
  end

  def promote_prompt(%Prompt{} = prompt) do
    update_prompt(prompt, %{status: "active", a_b_test_group: "control"})
  end

  # ---------------------------------------------------------------------------
  # Metrics and analysis
  # ---------------------------------------------------------------------------

  def execution_metrics(prompt_id, since) do
    executions_since(since)
    |> Enum.reduce(%{prompt_id: prompt_id, total: 0, successes: 0, success_rate: 0.0}, fn execution, acc ->
      prompt_meta = execution_prompt_metadata(execution)

      if prompt_meta["prompt_id"] == prompt_id do
        total = acc.total + 1
        successes = acc.successes + if(execution_success?(execution), do: 1, else: 0)

        %{acc | total: total, successes: successes, success_rate: ratio(successes, total)}
      else
        acc
      end
    end)
  end

  def test_metrics(%Prompt{} = control_prompt, variants, since) do
    entries = [control_prompt | variants]

    Enum.map(entries, fn prompt ->
      metrics = execution_metrics(prompt.id, since)

      %{
        prompt_id: prompt.id,
        a_b_test_group: prompt.a_b_test_group || "control",
        status: prompt.status,
        success_rate: metrics.success_rate,
        total: metrics.total,
        successes: metrics.successes
      }
    end)
  end

  def choose_test_winner(%Prompt{} = control_prompt, variants, since) do
    test_metrics(control_prompt, variants, since)
    |> Enum.filter(&(&1.total > 0))
    |> Enum.max_by(fn metric -> {metric.success_rate, metric.total, metric.prompt_id} end, fn -> nil end)
  end

  # ---------------------------------------------------------------------------
  # Legacy A/B helpers
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
    case active_variants_for_kind(kind) do
      [] -> latest_for_kind(kind)
      variants -> Enum.random(variants)
    end
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp executions_since(since) do
    Execution
    |> where([e], e.inserted_at >= ^since)
    |> Repo.all()
  end

  defp execution_prompt_metadata(execution) do
    Map.get(execution.metadata || %{}, "prompt") || %{}
  end

  defp execution_success?(execution) do
    prompt_meta = execution_prompt_metadata(execution)

    cond do
      is_boolean(prompt_meta["success"]) -> prompt_meta["success"]
      execution.status == "completed" -> true
      true -> false
    end
  end

  defp ratio(_num, 0), do: 0.0
  defp ratio(num, den), do: num / den

  defp next_version(kind) do
    case Repo.aggregate(from(p in Prompt, where: p.kind == ^kind), :max, :version) do
      nil -> 1
      current -> current + 1
    end
  end

  defp normalize_attrs(attrs) when is_map(attrs) do
    Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp generate_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
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
