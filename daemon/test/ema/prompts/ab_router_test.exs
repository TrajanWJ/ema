defmodule Ema.Prompts.ABRouterTest do
  use Ema.DataCase, async: false

  alias Ema.Prompts.ABRouter
  alias Ema.Prompts.Store

  defp unique_kind, do: "router_kind_#{System.unique_integer([:positive])}"

  test "routes 20/20/60 across control and variants and records execution metadata" do
    kind = unique_kind()
    {:ok, control} = Store.create_prompt(%{kind: kind, content: "control", a_b_test_group: "control"})

    {:ok, variant_a} =
      Store.create_new_version(kind, "variant a",
        a_b_test_group: "variant_A",
        status: "testing",
        control_prompt_id: control.id,
        parent_prompt_id: control.id
      )

    {:ok, variant_b} =
      Store.create_new_version(kind, "variant b",
        a_b_test_group: "variant_B",
        status: "testing",
        control_prompt_id: control.id,
        parent_prompt_id: control.id
      )

    {:ok, execution} =
      Ema.Executions.create(%{
        title: "Prompt-routed execution",
        mode: "implement",
        status: "created",
        requires_approval: true
      })

    assert {:ok, ^variant_a, %{"a_b_test_group" => "variant_A"}} =
             ABRouter.route(kind, bucket: 0.10, execution_id: execution.id)

    execution = Ema.Executions.get_execution!(execution.id)
    assert execution.metadata["prompt"]["prompt_id"] == variant_a.id

    assert {:ok, ^variant_b, %{"a_b_test_group" => "variant_B"}} =
             ABRouter.route(kind, bucket: 0.30)

    assert {:ok, ^control, %{"a_b_test_group" => "control"}} =
             ABRouter.route(kind, bucket: 0.80)
  end

  test "falls back to the active control when no variants exist" do
    kind = unique_kind()
    {:ok, control} = Store.create_prompt(%{kind: kind, content: "control", a_b_test_group: "control"})

    assert {:ok, ^control, %{"a_b_test_group" => "control"}} = ABRouter.route(kind, bucket: 0.05)
  end
end
