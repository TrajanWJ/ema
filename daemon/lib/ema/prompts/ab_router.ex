defmodule Ema.Prompts.ABRouter do
  @moduledoc """
  Routes prompt lookups across a control and active test variants.
  """

  alias Ema.Executions
  alias Ema.Executions.Execution
  alias Ema.Prompts.Store
  alias Ema.Repo

  @variant_a_share 0.20
  @variant_b_share 0.40

  def route(kind, opts \\ []) when is_binary(kind) do
    control = Store.active_control_for_kind(kind)
    variants = Store.active_variants_for_kind(kind)

    case {control, variants} do
      {nil, []} ->
        {:error, :not_found}

      {prompt, []} when not is_nil(prompt) ->
        selection = selection_metadata(kind, prompt, "control")
        maybe_record_execution_variant(opts[:execution_id], selection)
        {:ok, prompt, selection}

      {nil, variants} ->
        route_from_pool(kind, variants, opts)

      {control, variants} ->
        route_from_pool(kind, [control | variants], opts)
    end
  end

  def record_execution_variant(execution_id, selection)
      when is_binary(execution_id) and is_map(selection) do
    maybe_record_execution_variant(execution_id, selection)
  end

  def record_execution_variant(_execution_id, _selection), do: :ok

  defp route_from_pool(kind, prompts, opts) do
    bucket = opts[:bucket] || :rand.uniform()
    prompt = choose_prompt(prompts, bucket)
    selection = selection_metadata(kind, prompt, bucket_label(bucket, prompt))

    maybe_record_execution_variant(opts[:execution_id], selection)
    {:ok, prompt, selection}
  end

  defp choose_prompt(prompts, bucket) do
    control = Enum.find(prompts, &((&1.a_b_test_group || "control") == "control"))
    variant_a = Enum.find(prompts, &(&1.a_b_test_group in ["variant_A", "variant_a"]))
    variant_b = Enum.find(prompts, &(&1.a_b_test_group in ["variant_B", "variant_b"]))

    cond do
      bucket <= @variant_a_share and variant_a -> variant_a
      bucket <= @variant_b_share and variant_b -> variant_b
      not is_nil(control) -> control
      true -> List.first(prompts)
    end
  end

  defp bucket_label(bucket, prompt) do
    cond do
      prompt.a_b_test_group in ["variant_A", "variant_a"] and bucket <= @variant_a_share ->
        "variant_A"

      prompt.a_b_test_group in ["variant_B", "variant_b"] and bucket <= @variant_b_share ->
        "variant_B"

      true ->
        prompt.a_b_test_group || "control"
    end
  end

  defp selection_metadata(kind, prompt, route_bucket) do
    %{
      "kind" => kind,
      "prompt_id" => prompt.id,
      "version" => prompt.version,
      "a_b_test_group" => prompt.a_b_test_group || "control",
      "status" => prompt.status,
      "route_bucket" => route_bucket
    }
  end

  defp maybe_record_execution_variant(nil, _selection), do: :ok

  defp maybe_record_execution_variant(execution_id, selection) do
    case Executions.get_execution(execution_id) do
      nil ->
        :ok

      execution ->
        metadata = Map.put(execution.metadata || %{}, "prompt", selection)

        case Execution.changeset(execution, %{metadata: metadata}) |> Repo.update() do
          {:ok, _} -> :ok
          {:error, _} -> :ok
        end
    end
  end
end
