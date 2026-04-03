defmodule Ema.Core.DccPrimitiveTest do
  use ExUnit.Case, async: true

  alias Ema.Core.DccPrimitive

  describe "new/1" do
    test "generates a unique session_id" do
      dcc1 = DccPrimitive.new()
      dcc2 = DccPrimitive.new()
      assert String.starts_with?(dcc1.session_id, "dcc_")
      assert dcc1.session_id != dcc2.session_id
    end

    test "accepts custom session_id" do
      dcc = DccPrimitive.new(%{session_id: "custom_123"})
      assert dcc.session_id == "custom_123"
    end

    test "initializes with empty defaults" do
      dcc = DccPrimitive.new()
      assert dcc.active_task_ids == []
      assert dcc.decision_hashes == []
      assert dcc.intent_snapshot == %{}
      assert dcc.proposal_context == %{}
      assert dcc.session_narrative == nil
      assert dcc.crystallized_at == nil
      assert dcc.metadata == %{}
    end

    test "accepts attrs for all fields" do
      dcc =
        DccPrimitive.new(%{
          project_id: "proj_1",
          active_task_ids: ["t1", "t2"],
          decision_hashes: ["abc"],
          metadata: %{"key" => "val"}
        })

      assert dcc.project_id == "proj_1"
      assert dcc.active_task_ids == ["t1", "t2"]
      assert dcc.decision_hashes == ["abc"]
      assert dcc.metadata == %{"key" => "val"}
    end
  end

  describe "crystallize/1" do
    test "sets crystallized_at to current time" do
      dcc = DccPrimitive.new()
      assert dcc.crystallized_at == nil

      crystallized = DccPrimitive.crystallize(dcc)
      assert %DateTime{} = crystallized.crystallized_at
      assert DateTime.diff(DateTime.utc_now(), crystallized.crystallized_at) < 2
    end

    test "preserves all other fields" do
      dcc =
        DccPrimitive.new(%{
          project_id: "proj_1",
          active_task_ids: ["t1"],
          session_narrative: "doing work"
        })

      crystallized = DccPrimitive.crystallize(dcc)
      assert crystallized.project_id == "proj_1"
      assert crystallized.active_task_ids == ["t1"]
      assert crystallized.session_narrative == "doing work"
    end
  end

  describe "with_tasks/2" do
    test "sets active_task_ids" do
      dcc = DccPrimitive.new() |> DccPrimitive.with_tasks(["t1", "t2", "t3"])
      assert dcc.active_task_ids == ["t1", "t2", "t3"]
    end
  end

  describe "with_intent_snapshot/2" do
    test "sets intent_snapshot" do
      snapshot = %{goal: "ship feature", model: "opus"}
      dcc = DccPrimitive.new() |> DccPrimitive.with_intent_snapshot(snapshot)
      assert dcc.intent_snapshot == snapshot
    end
  end

  describe "with_narrative/2" do
    test "sets session_narrative" do
      dcc = DccPrimitive.new() |> DccPrimitive.with_narrative("Refactored auth module")
      assert dcc.session_narrative == "Refactored auth module"
    end
  end

  describe "to_map/1 and from_map/1 roundtrip" do
    test "roundtrips a fresh DCC" do
      dcc = DccPrimitive.new(%{session_id: "rt_1", project_id: "proj_1"})
      map = DccPrimitive.to_map(dcc)
      restored = DccPrimitive.from_map(map)

      assert restored.session_id == dcc.session_id
      assert restored.project_id == dcc.project_id
      assert restored.crystallized_at == nil
    end

    test "roundtrips a crystallized DCC" do
      dcc =
        DccPrimitive.new(%{
          session_id: "rt_2",
          active_task_ids: ["t1"],
          decision_hashes: ["h1", "h2"],
          session_narrative: "test narrative"
        })
        |> DccPrimitive.crystallize()

      map = DccPrimitive.to_map(dcc)
      restored = DccPrimitive.from_map(map)

      assert restored.session_id == "rt_2"
      assert restored.active_task_ids == ["t1"]
      assert restored.decision_hashes == ["h1", "h2"]
      assert restored.session_narrative == "test narrative"
      assert %DateTime{} = restored.crystallized_at
    end

    test "handles string keys from JSON decode" do
      json_map = %{
        "session_id" => "json_1",
        "crystallized_at" => nil,
        "project_id" => "p1",
        "active_task_ids" => ["t1"],
        "decision_hashes" => [],
        "intent_snapshot" => %{"goal" => "test"},
        "proposal_context" => %{},
        "session_narrative" => "from json",
        "metadata" => %{"source" => "test"}
      }

      dcc = DccPrimitive.from_map(json_map)
      assert dcc.session_id == "json_1"
      assert dcc.intent_snapshot == %{"goal" => "test"}
      assert dcc.session_narrative == "from json"
    end

    test "roundtrips through JSON encode/decode" do
      dcc =
        DccPrimitive.new(%{session_id: "json_rt", project_id: "p1"})
        |> DccPrimitive.with_tasks(["t1"])
        |> DccPrimitive.crystallize()

      {:ok, json} = dcc |> DccPrimitive.to_map() |> Jason.encode()
      {:ok, decoded} = Jason.decode(json)
      restored = DccPrimitive.from_map(decoded)

      assert restored.session_id == "json_rt"
      assert restored.active_task_ids == ["t1"]
      assert %DateTime{} = restored.crystallized_at
    end
  end
end
