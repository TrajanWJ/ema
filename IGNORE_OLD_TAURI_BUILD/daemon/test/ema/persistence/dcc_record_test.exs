defmodule Ema.Persistence.DccRecordTest do
  use Ema.DataCase, async: true

  alias Ema.Core.DccPrimitive
  alias Ema.Persistence.DccRecord

  describe "from_dcc/1" do
    test "converts a DCC to a record" do
      dcc = DccPrimitive.new(%{session_id: "test_1", project_id: "proj_1"})
      record = DccRecord.from_dcc(dcc)

      assert record.session_id == "test_1"
      assert record.crystallized == false
      assert is_binary(record.dcc_data)
    end

    test "sets crystallized flag from DCC state" do
      dcc = DccPrimitive.new(%{session_id: "test_2"}) |> DccPrimitive.crystallize()
      record = DccRecord.from_dcc(dcc)

      assert record.crystallized == true
    end
  end

  describe "to_dcc/1" do
    test "roundtrips through from_dcc -> to_dcc" do
      original =
        DccPrimitive.new(%{
          session_id: "rt_1",
          project_id: "proj_1",
          active_task_ids: ["t1", "t2"],
          decision_hashes: ["h1"],
          session_narrative: "did work"
        })

      record = DccRecord.from_dcc(original)
      {:ok, restored} = DccRecord.to_dcc(record)

      assert restored.session_id == "rt_1"
      assert restored.project_id == "proj_1"
      assert restored.active_task_ids == ["t1", "t2"]
      assert restored.decision_hashes == ["h1"]
      assert restored.session_narrative == "did work"
    end

    test "handles invalid JSON" do
      record = %DccRecord{session_id: "bad", dcc_data: "not json"}
      assert {:error, _} = DccRecord.to_dcc(record)
    end
  end

  describe "changeset/2" do
    test "validates required fields" do
      changeset = DccRecord.changeset(%DccRecord{}, %{})
      refute changeset.valid?
      assert %{session_id: _, dcc_data: _} = errors_on(changeset)
    end

    test "accepts valid attrs" do
      changeset =
        DccRecord.changeset(%DccRecord{}, %{
          session_id: "valid_1",
          dcc_data: "{}",
          crystallized: false
        })

      assert changeset.valid?
    end
  end
end
