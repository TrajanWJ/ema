defmodule Ema.Persistence.SessionStoreTest do
  use Ema.DataCase, async: false

  alias Ema.Core.DccPrimitive
  alias Ema.Persistence.SessionStore
  alias Ema.Persistence.DccRecord

  import Ema.Factory

  setup do
    # Start SessionStore for each test — it's disabled in test config
    start_supervised!(SessionStore)
    :ok
  end

  describe "store/2 and fetch/1" do
    test "stores and retrieves a DCC" do
      dcc = build(:dcc) |> DccPrimitive.new()
      assert :ok = SessionStore.store(dcc.session_id, dcc)
      assert {:ok, fetched} = SessionStore.fetch(dcc.session_id)
      assert fetched.session_id == dcc.session_id
    end

    test "returns :error for unknown session" do
      assert :error = SessionStore.fetch("nonexistent")
    end

    test "overwrites existing DCC" do
      dcc = DccPrimitive.new(%{session_id: "overwrite_1", project_id: "p1"})
      SessionStore.store("overwrite_1", dcc)

      updated = %{dcc | project_id: "p2"}
      SessionStore.store("overwrite_1", updated)

      {:ok, fetched} = SessionStore.fetch("overwrite_1")
      assert fetched.project_id == "p2"
    end
  end

  describe "crystallize/1" do
    test "marks session as crystallized" do
      dcc = DccPrimitive.new(%{session_id: "cryst_1"})
      SessionStore.store("cryst_1", dcc)

      assert {:ok, crystallized} = SessionStore.crystallize("cryst_1")
      assert %DateTime{} = crystallized.crystallized_at
    end

    test "returns error for unknown session" do
      assert {:error, :not_found} = SessionStore.crystallize("nonexistent")
    end

    test "broadcasts crystallization event" do
      Phoenix.PubSub.subscribe(Ema.PubSub, "context:sessions")

      dcc = DccPrimitive.new(%{session_id: "cryst_bc"})
      SessionStore.store("cryst_bc", dcc)
      SessionStore.crystallize("cryst_bc")

      assert_receive {:session_crystallized, crystallized}, 1000
      assert crystallized.session_id == "cryst_bc"
    end
  end

  describe "delete/1" do
    test "removes from ETS and SQLite" do
      dcc = DccPrimitive.new(%{session_id: "del_1"})
      SessionStore.store("del_1", dcc)
      SessionStore.flush()

      # Verify it's in the DB
      assert Repo.get(DccRecord, "del_1") != nil

      SessionStore.delete("del_1")
      assert :error = SessionStore.fetch("del_1")
      assert Repo.get(DccRecord, "del_1") == nil
    end
  end

  describe "list_recent/1" do
    test "returns sessions sorted by crystallized_at desc" do
      dcc1 = DccPrimitive.new(%{session_id: "recent_1"}) |> DccPrimitive.crystallize()
      Process.sleep(10)
      dcc2 = DccPrimitive.new(%{session_id: "recent_2"}) |> DccPrimitive.crystallize()

      SessionStore.store("recent_1", dcc1)
      SessionStore.store("recent_2", dcc2)

      recent = SessionStore.list_recent(10)
      ids = Enum.map(recent, & &1.session_id)
      assert "recent_2" in ids
      assert "recent_1" in ids
    end

    test "respects limit" do
      for i <- 1..5 do
        dcc = DccPrimitive.new(%{session_id: "lim_#{i}"}) |> DccPrimitive.crystallize()
        SessionStore.store("lim_#{i}", dcc)
      end

      assert length(SessionStore.list_recent(2)) == 2
    end
  end

  describe "current_session/0 and set_current/1" do
    test "tracks current active session" do
      assert SessionStore.current_session() == nil

      dcc = DccPrimitive.new(%{session_id: "current_1"})
      SessionStore.store("current_1", dcc)
      SessionStore.set_current("current_1")

      current = SessionStore.current_session()
      assert current.session_id == "current_1"
    end
  end

  describe "flush/0 — persistence to SQLite" do
    test "persists dirty records to database" do
      dcc = DccPrimitive.new(%{session_id: "flush_1", project_id: "p1"})
      SessionStore.store("flush_1", dcc)

      # Before flush, not in DB
      assert Repo.get(DccRecord, "flush_1") == nil

      SessionStore.flush()

      # After flush, in DB
      record = Repo.get(DccRecord, "flush_1")
      assert record != nil
      assert record.crystallized == false

      {:ok, restored} = DccRecord.to_dcc(record)
      assert restored.session_id == "flush_1"
      assert restored.project_id == "p1"
    end

    test "persists crystallized state" do
      dcc = DccPrimitive.new(%{session_id: "flush_cryst"})
      SessionStore.store("flush_cryst", dcc)
      SessionStore.crystallize("flush_cryst")
      SessionStore.flush()

      record = Repo.get(DccRecord, "flush_cryst")
      assert record.crystallized == true
    end
  end

  describe "restart + resume cycle" do
    test "sessions survive GenServer restart" do
      # Store some sessions
      dcc1 =
        DccPrimitive.new(%{session_id: "survive_1", project_id: "p1"})
        |> DccPrimitive.with_tasks(["t1", "t2"])
        |> DccPrimitive.with_narrative("important work")

      dcc2 =
        DccPrimitive.new(%{session_id: "survive_2"})
        |> DccPrimitive.crystallize()

      SessionStore.store("survive_1", dcc1)
      SessionStore.store("survive_2", dcc2)

      # Flush to SQLite
      SessionStore.flush()

      # Stop the GenServer (simulates daemon crash/restart)
      stop_supervised!(SessionStore)

      # Verify ETS is gone (table destroyed with owning process)
      assert :ets.whereis(:ema_session_store) == :undefined

      # Restart
      start_supervised!(SessionStore)

      # Verify sessions are restored from SQLite
      {:ok, restored1} = SessionStore.fetch("survive_1")
      assert restored1.session_id == "survive_1"
      assert restored1.project_id == "p1"
      assert restored1.active_task_ids == ["t1", "t2"]
      assert restored1.session_narrative == "important work"

      {:ok, restored2} = SessionStore.fetch("survive_2")
      assert restored2.session_id == "survive_2"
      assert %DateTime{} = restored2.crystallized_at
    end

    test "dirty records not yet flushed are lost on crash" do
      dcc = DccPrimitive.new(%{session_id: "unflushed_1"})
      SessionStore.store("unflushed_1", dcc)

      # Don't flush — simulate crash
      stop_supervised!(SessionStore)
      start_supervised!(SessionStore)

      # Should be gone
      assert :error = SessionStore.fetch("unflushed_1")
    end

    test "partial flush preserves flushed records" do
      dcc1 = DccPrimitive.new(%{session_id: "partial_1"})
      SessionStore.store("partial_1", dcc1)
      SessionStore.flush()

      dcc2 = DccPrimitive.new(%{session_id: "partial_2"})
      SessionStore.store("partial_2", dcc2)
      # Don't flush dcc2

      stop_supervised!(SessionStore)
      start_supervised!(SessionStore)

      assert {:ok, _} = SessionStore.fetch("partial_1")
      assert :error = SessionStore.fetch("partial_2")
    end
  end

  describe "count/0" do
    test "returns number of sessions in ETS" do
      assert SessionStore.count() == 0

      dcc = DccPrimitive.new(%{session_id: "count_1"})
      SessionStore.store("count_1", dcc)

      assert SessionStore.count() == 1
    end
  end
end
