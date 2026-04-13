defmodule Ema.ExecutionsTest do
  use Ema.DataCase, async: false

  alias Ema.Executions

  import Ema.Factory

  setup do
    tmp_root =
      Path.join(
        System.tmp_dir!(),
        "ema-executions-test-#{System.unique_integer([:positive])}"
      )

    File.mkdir_p!(tmp_root)
    on_exit(fn -> File.rm_rf!(tmp_root) end)

    {:ok, tmp_root: tmp_root}
  end

  test "create/1 auto-anchors executions into the project's .superman folder", %{
    tmp_root: tmp_root
  } do
    project = insert!(:project, %{linked_path: tmp_root})

    assert {:ok, execution} =
             Executions.create(%{
               title: "Stabilize dispatch board",
               objective: "Ship a stable dispatch board loop",
               mode: "implement",
               status: "created",
               project_slug: project.slug,
               requires_approval: false
             })

    intent_dir = Path.join([tmp_root, ".superman", "intents", execution.intent_slug])

    assert execution.intent_path == ".superman/intents/#{execution.intent_slug}"
    assert File.dir?(intent_dir)
    assert File.exists?(Path.join(intent_dir, "intent.md"))
    assert File.exists?(Path.join(intent_dir, "status.json"))
  end

  test "on_execution_completed/2 patches result files into the linked project path", %{
    tmp_root: tmp_root
  } do
    project = insert!(:project, %{linked_path: tmp_root})

    {:ok, execution} =
      Executions.create(%{
        title: "Wire babysitter patchback",
        objective: "Close the loop cleanly",
        mode: "implement",
        status: "created",
        project_slug: project.slug,
        requires_approval: true
      })

    assert {:ok, completed} =
             Executions.on_execution_completed(execution.id, "# Result\n\nLoop closed.")

    result_file =
      Path.join([tmp_root, ".superman", "intents", execution.intent_slug, "result.md"])

    log_file =
      Path.join([tmp_root, ".superman", "intents", execution.intent_slug, "execution-log.md"])

    assert completed.status == "completed"
    assert File.read!(result_file) =~ "Loop closed."
    assert File.read!(log_file) =~ execution.id
  end
end
