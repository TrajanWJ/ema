defmodule Ema.Prompts.OptimizerTest do
  use Ema.DataCase, async: false

  import Ecto.Query

  alias Ema.Executions.Execution
  alias Ema.Prompts.Optimizer
  alias Ema.Prompts.Store
  alias Ema.Repo

  defp unique_kind, do: "optimizer_kind_#{System.unique_integer([:positive])}"
  defp unique_name, do: :"prompt_optimizer_test_#{System.unique_integer([:positive])}"

  test "calculates the next Sunday 02:00 UTC correctly" do
    friday = DateTime.from_naive!(~N[2026-04-10 12:30:00], "Etc/UTC")
    sunday_after_run = DateTime.from_naive!(~N[2026-04-12 03:00:00], "Etc/UTC")

    assert Optimizer.next_run_after(friday) == DateTime.from_naive!(~N[2026-04-12 02:00:00], "Etc/UTC")

    assert Optimizer.next_run_after(sunday_after_run) ==
             DateTime.from_naive!(~N[2026-04-19 02:00:00], "Etc/UTC")
  end

  test "creates testing variants for underperforming prompts" do
    kind = unique_kind()
    {:ok, control} = Store.create_prompt(%{kind: kind, content: "control", a_b_test_group: "control"})

    insert_execution_for_prompt(control.id, "completed")
    insert_execution_for_prompt(control.id, "failed")

    server = unique_name()

    pid =
      start_supervised!(
        {Optimizer,
         name: server,
         now: DateTime.from_naive!(~N[2026-04-12 01:00:00], "Etc/UTC"),
         clock: fn -> DateTime.from_naive!(~N[2026-04-12 01:00:00], "Etc/UTC") end,
         bridge_runner: fn _prompt, _control ->
           {:ok,
            Jason.encode!([
              %{"variant_id" => "a", "content" => "variant A", "rationale" => "clearer"},
              %{"variant_id" => "b", "content" => "variant B", "rationale" => "tighter"}
            ])}
         end}}
      )

    Optimizer.optimize(server)
    _ = :sys.get_state(pid)

    variants = Store.active_variants_for_prompt(control.id)
    assert Enum.map(variants, & &1.a_b_test_group) == ["variant_A", "variant_B"]
    assert Enum.all?(variants, &(&1.status == "testing"))
  end

  test "promotes the winning variant after seven days of test data" do
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

    old_time = DateTime.from_naive!(~N[2026-04-04 00:00:00], "Etc/UTC")

    Repo.update_all(from(p in Ema.Prompts.Prompt, where: p.id in ^[variant_a.id, variant_b.id]), set: [inserted_at: old_time])

    insert_execution_for_prompt(control.id, "completed")
    insert_execution_for_prompt(control.id, "failed")
    insert_execution_for_prompt(variant_a.id, "completed")
    insert_execution_for_prompt(variant_a.id, "completed")
    insert_execution_for_prompt(variant_b.id, "failed")

    server = unique_name()

    pid =
      start_supervised!(
        {Optimizer,
         name: server,
         now: DateTime.from_naive!(~N[2026-04-12 03:00:00], "Etc/UTC"),
         clock: fn -> DateTime.from_naive!(~N[2026-04-12 03:00:00], "Etc/UTC") end,
         bridge_runner: fn _prompt, _control -> {:error, :not_used} end}}
      )

    Optimizer.optimize(server)
    _ = :sys.get_state(pid)

    promoted = Store.get_prompt!(variant_a.id)
    archived_control = Store.get_prompt!(control.id)
    archived_variant_b = Store.get_prompt!(variant_b.id)

    assert promoted.status == "active"
    assert promoted.a_b_test_group == "control"
    assert archived_control.status == "archived"
    assert archived_variant_b.status == "archived"
  end

  defp insert_execution_for_prompt(prompt_id, status) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    %Execution{}
    |> Execution.changeset(%{
      id: "exec_#{System.unique_integer([:positive])}",
      title: "execution #{System.unique_integer([:positive])}",
      mode: "implement",
      status: status,
      requires_approval: true,
      metadata: %{"prompt" => %{"prompt_id" => prompt_id}}
    })
    |> Repo.insert!()
    |> then(fn execution ->
      Repo.update_all(from(e in Execution, where: e.id == ^execution.id), set: [inserted_at: now, updated_at: now])
    end)
  end
end
