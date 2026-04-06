defmodule Ema.ActorsTest do
  use Ema.DataCase, async: false
  alias Ema.Actors

  describe "create_actor/1" do
    test "creates a human actor" do
      {:ok, actor} = Actors.create_actor(%{name: "Test Human", slug: "test-human", actor_type: "human"})
      assert actor.actor_type == "human"
      assert actor.status == "active"
      assert actor.phase == "idle"
    end

    test "creates an agent actor" do
      {:ok, actor} = Actors.create_actor(%{name: "Alpha", slug: "alpha-test", actor_type: "agent"})
      assert actor.actor_type == "agent"
    end
  end

  describe "list_actors/1" do
    test "filters by type" do
      {:ok, _} = Actors.create_actor(%{name: "H", slug: "list-h-#{System.unique_integer([:positive])}", actor_type: "human"})
      {:ok, _} = Actors.create_actor(%{name: "A", slug: "list-a-#{System.unique_integer([:positive])}", actor_type: "agent"})
      agents = Actors.list_actors(type: "agent")
      assert Enum.all?(agents, &(&1.actor_type == "agent"))
    end
  end

  describe "update_actor/2" do
    test "updates config" do
      {:ok, actor} = Actors.create_actor(%{name: "Cfg", slug: "cfg-#{System.unique_integer([:positive])}", actor_type: "agent"})
      {:ok, updated} = Actors.update_actor(actor, %{config: %{"phases" => ["plan", "execute"]}})
      assert updated.config == %{"phases" => ["plan", "execute"]}
    end
  end

  describe "ensure_default_human_actor/0" do
    test "returns a trajan actor" do
      {:ok, actor} = Actors.ensure_default_human_actor()
      assert actor.slug == "trajan"
      assert actor.actor_type == "human"
    end

    test "is idempotent" do
      {:ok, first} = Actors.ensure_default_human_actor()
      {:ok, second} = Actors.ensure_default_human_actor()
      assert first.id == second.id
    end
  end

  # ── Tags ──

  describe "tag_entity/5" do
    setup do
      {:ok, actor} = Actors.create_actor(%{name: "Tagger", slug: "tagger-#{System.unique_integer([:positive])}", actor_type: "human"})
      {:ok, actor: actor}
    end

    test "creates a tag on an entity", %{actor: actor} do
      assert {:ok, tag} = Actors.tag_entity("task", "task_1", "urgent", actor.id)
      assert tag.entity_type == "task"
      assert tag.entity_id == "task_1"
      assert tag.tag == "urgent"
    end

    test "is idempotent", %{actor: actor} do
      {:ok, _} = Actors.tag_entity("task", "task_1", "urgent", actor.id)
      {:ok, _} = Actors.tag_entity("task", "task_1", "urgent", actor.id)
      assert length(Actors.tags_for_entity("task", "task_1")) == 1
    end

    test "different actors can tag same entity", %{actor: actor} do
      {:ok, agent} = Actors.create_actor(%{name: "Agent", slug: "tag-agent-#{System.unique_integer([:positive])}", actor_type: "agent"})
      {:ok, _} = Actors.tag_entity("task", "task_2", "urgent", actor.id)
      {:ok, _} = Actors.tag_entity("task", "task_2", "phase:execute", agent.id)
      assert length(Actors.tags_for_entity("task", "task_2")) == 2
    end
  end

  describe "untag_entity/4" do
    test "removes a tag" do
      {:ok, actor} = Actors.create_actor(%{name: "U", slug: "untag-#{System.unique_integer([:positive])}", actor_type: "human"})
      {:ok, _} = Actors.tag_entity("task", "task_3", "remove-me", actor.id)
      assert {1, _} = Actors.untag_entity("task", "task_3", "remove-me", actor.id)
      assert Actors.tags_for_entity("task", "task_3") == []
    end
  end

  describe "list_tags/1" do
    test "filters by entity_type" do
      {:ok, actor} = Actors.create_actor(%{name: "LT", slug: "lt-#{System.unique_integer([:positive])}", actor_type: "human"})
      {:ok, _} = Actors.tag_entity("task", "lt_t1", "a", actor.id)
      {:ok, _} = Actors.tag_entity("project", "lt_p1", "b", actor.id)
      tags = Actors.list_tags(entity_type: "task", actor_id: actor.id)
      assert length(tags) == 1
      assert hd(tags).entity_type == "task"
    end
  end

  # ── Entity Data ──

  describe "set_data/5" do
    setup do
      {:ok, actor} = Actors.create_actor(%{name: "ED", slug: "ed-#{System.unique_integer([:positive])}", actor_type: "human"})
      {:ok, actor: actor}
    end

    test "creates entity data", %{actor: actor} do
      {:ok, data} = Actors.set_data(actor.id, "task", "t1", "priority", "high")
      assert data.key == "priority"
    end

    test "upserts on conflict", %{actor: actor} do
      {:ok, _} = Actors.set_data(actor.id, "task", "t1", "priority", "low")
      {:ok, _} = Actors.set_data(actor.id, "task", "t1", "priority", "high")
      items = Actors.list_data(actor.id, "task", "t1")
      assert length(items) == 1
    end
  end

  describe "get_data/4" do
    test "returns nil when not found" do
      {:ok, actor} = Actors.create_actor(%{name: "GD", slug: "gd-#{System.unique_integer([:positive])}", actor_type: "human"})
      assert Actors.get_data(actor.id, "task", "t1", "missing") == nil
    end
  end

  describe "delete_data/4" do
    test "removes entity data" do
      {:ok, actor} = Actors.create_actor(%{name: "DD", slug: "dd-#{System.unique_integer([:positive])}", actor_type: "human"})
      {:ok, _} = Actors.set_data(actor.id, "project", "p1", "phase", "execute")
      assert {1, _} = Actors.delete_data(actor.id, "project", "p1", "phase")
      assert Actors.get_data(actor.id, "project", "p1", "phase") == nil
    end
  end

  # ── Container Config ──

  describe "set_config/4" do
    test "creates config entry" do
      {:ok, config} = Actors.set_config("project", "proj_1", "default_tags", "[\"elixir\"]")
      assert config.key == "default_tags"
    end

    test "upserts on conflict" do
      {:ok, _} = Actors.set_config("project", "proj_cc", "agent", "alpha")
      {:ok, _} = Actors.set_config("project", "proj_cc", "agent", "beta")
      configs = Actors.list_config("project", "proj_cc")
      assert length(configs) == 1
    end
  end

  describe "get_config/3" do
    test "returns nil when not found" do
      assert Actors.get_config("space", "sp_none", "missing") == nil
    end
  end

  # ── Phase Transitions ──

  describe "transition_phase/3" do
    setup do
      {:ok, actor} = Actors.create_actor(%{name: "PT", slug: "pt-#{System.unique_integer([:positive])}", actor_type: "agent", phase: "idle"})
      {:ok, actor: actor}
    end

    test "transitions phase and records transition", %{actor: actor} do
      {:ok, updated} = Actors.transition_phase(actor, "plan", reason: "sprint start", week_number: 1)
      assert updated.phase == "plan"
      assert updated.phase_started_at != nil

      [transition | _] = Actors.list_phase_transitions(actor.id)
      assert transition.from_phase == "idle"
      assert transition.to_phase == "plan"
      assert transition.reason == "sprint start"
      assert transition.week_number == 1
      assert transition.transitioned_at != nil
    end

    test "records summary", %{actor: actor} do
      {:ok, _} = Actors.transition_phase(actor, "execute",
        reason: "work_complete",
        summary: "Planned 5 tasks"
      )

      [transition | _] = Actors.list_phase_transitions(actor.id)
      assert transition.summary == "Planned 5 tasks"
      assert transition.reason == "work_complete"
    end

    test "full organic week cycle", %{actor: actor} do
      {:ok, a1} = Actors.transition_phase(actor, "plan", reason: "start", week_number: 1)
      {:ok, a2} = Actors.transition_phase(a1, "execute", reason: "planned", week_number: 1)
      {:ok, a3} = Actors.transition_phase(a2, "review", reason: "work_complete", week_number: 1)
      {:ok, _a4} = Actors.transition_phase(a3, "retro", reason: "reviewed", week_number: 1)

      transitions = Actors.list_phase_transitions(actor.id)
      assert length(transitions) == 4
      weeks = transitions |> Enum.map(& &1.week_number) |> Enum.uniq()
      assert weeks == [1]
    end
  end

  # ── Actor Commands ──

  describe "register_command/1" do
    test "registers a command" do
      {:ok, actor} = Actors.create_actor(%{name: "Cmd", slug: "cmd-#{System.unique_integer([:positive])}", actor_type: "agent"})
      {:ok, cmd} = Actors.register_command(%{actor_id: actor.id, command_name: "sprint status", description: "Show sprint", handler: "/api/sprint"})
      assert cmd.command_name == "sprint status"
    end
  end

  describe "list_commands/1" do
    test "returns commands for actor" do
      {:ok, actor} = Actors.create_actor(%{name: "LC", slug: "lc-#{System.unique_integer([:positive])}", actor_type: "agent"})
      {:ok, _} = Actors.register_command(%{actor_id: actor.id, command_name: "sprint", description: "Sprint", handler: "/sprint"})
      {:ok, _} = Actors.register_command(%{actor_id: actor.id, command_name: "retro", description: "Retro", handler: "/retro"})
      cmds = Actors.list_commands(actor.id)
      assert length(cmds) == 2
    end
  end
end
