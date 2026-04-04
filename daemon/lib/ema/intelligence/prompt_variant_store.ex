defmodule Ema.Intelligence.PromptVariantStore do
  @moduledoc """
  Cachex-backed store for prompt variants per {agent, task_type}.
  Tracks win rates for epsilon-greedy bandit selection.

  A variant is a prompt template string for a specific agent/task_type combo.
  Selection uses epsilon-greedy: explore random variants with prob epsilon,
  exploit highest win-rate variant otherwise.
  """

  @cache_name :prompt_variants
  @default_epsilon 0.15

  @type variant :: %{
          id: binary(),
          agent: atom(),
          task_type: atom(),
          template: binary(),
          wins: non_neg_integer(),
          trials: non_neg_integer(),
          win_rate: float(),
          created_at: binary()
        }

  def child_spec(_opts) do
    %{Cachex.child_spec(name: @cache_name) | id: __MODULE__}
  end

  @doc "Store a new prompt variant. Returns {:ok, variant_id}."
  def put_variant(agent, task_type, template, id \\ nil) do
    variant_id = id || :crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false)
    key = variant_key(agent, task_type, variant_id)

    variant = %{
      id: variant_id,
      agent: agent,
      task_type: task_type,
      template: template,
      wins: 0,
      trials: 0,
      win_rate: 0.0,
      created_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    case Cachex.put(@cache_name, key, variant) do
      {:ok, true} -> {:ok, variant_id}
      error -> error
    end
  end

  @doc "List all variants for a given agent + task_type."
  def list_variants(agent, task_type) do
    prefix = variant_prefix(agent, task_type)

    case Cachex.keys(@cache_name) do
      {:ok, keys} ->
        keys
        |> Enum.filter(&String.starts_with?(to_string(&1), prefix))
        |> Enum.flat_map(fn k ->
          case Cachex.get(@cache_name, k) do
            {:ok, v} when not is_nil(v) -> [v]
            _ -> []
          end
        end)

      _ ->
        []
    end
  end

  @doc """
  Record an outcome for a variant.
  outcome: :win | :loss
  """
  def record_outcome(agent, task_type, variant_id, outcome) do
    key = variant_key(agent, task_type, variant_id)

    Cachex.get_and_update(@cache_name, key, fn
      nil ->
        {:ignore, nil}

      v ->
        new_trials = v.trials + 1
        new_wins = if outcome == :win, do: v.wins + 1, else: v.wins
        updated = %{v | trials: new_trials, wins: new_wins, win_rate: new_wins / new_trials}
        {:commit, updated}
    end)

    :ok
  end

  @doc """
  Select a variant using epsilon-greedy bandit.
  Returns {:ok, variant} or {:error, :no_variants}.
  """
  def select_variant(agent, task_type, epsilon \\ @default_epsilon) do
    case list_variants(agent, task_type) do
      [] ->
        {:error, :no_variants}

      variants ->
        chosen =
          if :rand.uniform() < epsilon do
            Enum.random(variants)
          else
            Enum.max_by(variants, fn v ->
              if v.trials == 0, do: 1.0, else: v.win_rate
            end)
          end

        {:ok, chosen}
    end
  end

  @doc "Get a specific variant by id."
  def get_variant(agent, task_type, variant_id) do
    key = variant_key(agent, task_type, variant_id)

    case Cachex.get(@cache_name, key) do
      {:ok, v} when not is_nil(v) -> {:ok, v}
      _ -> {:error, :not_found}
    end
  end

  @doc "Delete a variant."
  def delete_variant(agent, task_type, variant_id) do
    key = variant_key(agent, task_type, variant_id)
    Cachex.del(@cache_name, key)
    :ok
  end

  # --- Private ---

  defp variant_key(agent, task_type, id), do: "#{agent}:#{task_type}:#{id}"
  defp variant_prefix(agent, task_type), do: "#{agent}:#{task_type}:"
end
