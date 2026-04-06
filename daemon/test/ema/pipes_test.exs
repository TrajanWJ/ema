defmodule Ema.PipesTest do
  use Ema.DataCase, async: false

  alias Ema.Pipes
  alias Ema.Pipes.Registry

  setup do
    start_supervised!(Ema.Pipes.Supervisor)
    :ok
  end

  describe "create_pipe/1" do
    test "creates a pipe with valid attrs" do
      assert {:ok, pipe} =
               Pipes.create_pipe(%{
                 name: "Test Pipe",
                 trigger_pattern: "tasks:created",
                 description: "A test pipe"
               })

      assert pipe.name == "Test Pipe"
      assert pipe.trigger_pattern == "tasks:created"
      assert pipe.active == true
      assert pipe.system == false
      assert String.starts_with?(pipe.id, "pipe_")
    end

    test "fails without required fields" do
      assert {:error, changeset} = Pipes.create_pipe(%{})
      assert %{name: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates trigger_pattern format" do
      assert {:error, changeset} =
               Pipes.create_pipe(%{name: "Bad", trigger_pattern: "invalid"})

      assert %{trigger_pattern: [_]} = errors_on(changeset)
    end

    test "accepts optional fields" do
      assert {:ok, pipe} =
               Pipes.create_pipe(%{
                 name: "Full Pipe",
                 trigger_pattern: "system:daily",
                 description: "Full pipe",
                 metadata: %{"key" => "value"},
                 active: false,
                 system: true
               })

      assert pipe.description == "Full pipe"
      assert pipe.metadata == %{"key" => "value"}
      assert pipe.active == false
      assert pipe.system == true
    end
  end

  describe "list_pipes/1" do
    test "returns all pipes ordered by name" do
      {:ok, _} = Pipes.create_pipe(%{name: "Zebra", trigger_pattern: "system:daily"})
      {:ok, _} = Pipes.create_pipe(%{name: "Alpha", trigger_pattern: "tasks:created"})

      pipes = Pipes.list_pipes()
      assert length(pipes) >= 2
      names = Enum.map(pipes, & &1.name)
      assert Enum.find_index(names, &(&1 == "Alpha")) < Enum.find_index(names, &(&1 == "Zebra"))
    end

    test "filters by active" do
      {:ok, _} =
        Pipes.create_pipe(%{name: "Active", trigger_pattern: "system:daily", active: true})

      {:ok, _} =
        Pipes.create_pipe(%{name: "Inactive", trigger_pattern: "tasks:created", active: false})

      active = Pipes.list_pipes(active: true)
      inactive = Pipes.list_pipes(active: false)

      assert Enum.all?(active, & &1.active)
      assert Enum.all?(inactive, &(!&1.active))
    end

    test "filters by system" do
      {:ok, _} =
        Pipes.create_pipe(%{name: "System", trigger_pattern: "system:daily", system: true})

      {:ok, _} =
        Pipes.create_pipe(%{name: "User", trigger_pattern: "tasks:created", system: false})

      system = Pipes.list_pipes(system: true)
      assert Enum.all?(system, & &1.system)
    end
  end

  describe "toggle_pipe/1" do
    test "toggles active state" do
      {:ok, pipe} = Pipes.create_pipe(%{name: "Toggle Me", trigger_pattern: "system:daily"})
      assert pipe.active == true

      {:ok, toggled} = Pipes.toggle_pipe(pipe)
      assert toggled.active == false

      {:ok, toggled_back} = Pipes.toggle_pipe(toggled)
      assert toggled_back.active == true
    end
  end

  describe "delete_pipe/1" do
    test "deletes a non-system pipe" do
      {:ok, pipe} = Pipes.create_pipe(%{name: "Delete Me", trigger_pattern: "system:daily"})
      assert {:ok, _} = Pipes.delete_pipe(pipe)
      assert Pipes.get_pipe(pipe.id) == nil
    end

    test "refuses to delete a system pipe" do
      {:ok, pipe} =
        Pipes.create_pipe(%{name: "System", trigger_pattern: "system:daily", system: true})

      assert {:error, :cannot_delete_system_pipe} = Pipes.delete_pipe(pipe)
      assert Pipes.get_pipe(pipe.id) != nil
    end
  end

  describe "fork_pipe/1" do
    test "creates an editable copy of a system pipe" do
      {:ok, pipe} =
        Pipes.create_pipe(%{name: "Original", trigger_pattern: "system:daily", system: true})

      {:ok, _} =
        Pipes.add_action(pipe, %{action_id: "tasks:create", config: %{"from_proposal" => true}})

      {:ok, _} =
        Pipes.add_transform(pipe, %{transform_type: "filter", config: %{"field" => "priority"}})

      # Re-fetch with preloads
      pipe = Pipes.get_pipe(pipe.id)

      {:ok, forked} = Pipes.fork_pipe(pipe)
      assert forked.name == "Original (fork)"
      assert forked.system == false
      assert forked.active == false
      assert forked.trigger_pattern == "system:daily"
      assert forked.metadata["forked_from"] == pipe.id

      forked = Pipes.get_pipe(forked.id)
      assert length(forked.pipe_actions) == 1
      assert length(forked.pipe_transforms) == 1
      assert hd(forked.pipe_actions).action_id == "tasks:create"
      assert hd(forked.pipe_transforms).transform_type == "filter"
    end
  end

  describe "actions and transforms" do
    test "add and remove actions" do
      {:ok, pipe} = Pipes.create_pipe(%{name: "Actions Test", trigger_pattern: "system:daily"})
      {:ok, action} = Pipes.add_action(pipe, %{action_id: "tasks:create", config: %{}})
      assert action.action_id == "tasks:create"
      assert action.sort_order == 0

      {:ok, action2} = Pipes.add_action(pipe, %{action_id: "notify:log"})
      assert action2.sort_order == 1

      assert {:ok, _} = Pipes.remove_action(pipe, action.id)

      pipe = Pipes.get_pipe(pipe.id)
      assert length(pipe.pipe_actions) == 1
    end

    test "add and remove transforms" do
      {:ok, pipe} = Pipes.create_pipe(%{name: "Transforms Test", trigger_pattern: "system:daily"})

      {:ok, transform} =
        Pipes.add_transform(pipe, %{transform_type: "filter", config: %{"field" => "x"}})

      assert transform.transform_type == "filter"

      assert {:ok, _} = Pipes.remove_transform(pipe, transform.id)

      pipe = Pipes.get_pipe(pipe.id)
      assert length(pipe.pipe_transforms) == 0
    end

    test "validates transform type" do
      {:ok, pipe} = Pipes.create_pipe(%{name: "Bad Transform", trigger_pattern: "system:daily"})
      assert {:error, changeset} = Pipes.add_transform(pipe, %{transform_type: "invalid"})
      assert %{transform_type: [_]} = errors_on(changeset)
    end
  end

  describe "record_run/2 and execution_history/1" do
    test "records and retrieves pipe runs" do
      {:ok, pipe} = Pipes.create_pipe(%{name: "Run Test", trigger_pattern: "system:daily"})

      {:ok, run} =
        Pipes.record_run(pipe, %{
          status: "success",
          trigger_event: %{pattern: "system:daily", payload: %{}},
          started_at: DateTime.utc_now(),
          completed_at: DateTime.utc_now()
        })

      assert run.status == "success"
      assert run.pipe_id == pipe.id

      history = Pipes.execution_history(pipe.id)
      assert length(history) == 1
      assert hd(history).id == run.id
    end
  end

  describe "Registry" do
    test "lists triggers" do
      triggers = Registry.list_triggers()
      assert length(triggers) > 0

      ids = Enum.map(triggers, & &1.id)
      assert "tasks:created" in ids
      assert "system:daily" in ids
      assert "proposals:approved" in ids
    end

    test "lists actions" do
      actions = Registry.list_actions()
      assert length(actions) > 0

      ids = Enum.map(actions, & &1.action_id)
      assert "tasks:create" in ids
      assert "notify:log" in ids
    end

    test "gets a specific action" do
      action = Registry.get_action("tasks:create")
      assert action != nil
      assert action.label == "Create Task"
    end

    test "returns nil for unknown action" do
      assert Registry.get_action("nonexistent:action") == nil
    end

    test "lists transforms" do
      transforms = Registry.list_transforms()
      assert length(transforms) == 5
      types = Enum.map(transforms, & &1.type)
      assert :filter in types
      assert :map in types
      assert :delay in types
    end
  end

  describe "Executor matching" do
    # Executor is disabled in test mode (pipes_workers: false) to avoid
    # DB sandbox conflicts. These tests verify the Registry is up instead.
    test "registry process is running" do
      assert Process.whereis(Ema.Pipes.Registry) != nil
    end

    test "executor is not started in test mode" do
      # Executor/Loader are disabled via config :ema, pipes_workers: false
      assert Process.whereis(Ema.Pipes.Executor) == nil
      assert Process.whereis(Ema.Pipes.Loader) == nil
    end

    test "pipes supervisor is running" do
      assert Process.whereis(Ema.Pipes.Supervisor) != nil
    end
  end
end
