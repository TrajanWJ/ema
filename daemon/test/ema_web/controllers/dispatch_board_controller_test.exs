defmodule EmaWeb.DispatchBoardControllerTest do
  use EmaWeb.ConnCase, async: false

  describe "GET /api/dispatch-board" do
    test "returns board with running, queued, completed lists", %{conn: conn} do
      conn = get(conn, "/api/dispatch-board")
      body = json_response(conn, 200)
      assert is_list(body["running"])
      assert is_list(body["queued"])
      assert is_list(body["completed"])
      assert is_map(body["counts"])
    end

    test "counts has running, queued, completed_today keys", %{conn: conn} do
      conn = get(conn, "/api/dispatch-board")
      body = json_response(conn, 200)
      counts = body["counts"]
      assert is_integer(counts["running"])
      assert is_integer(counts["queued"])
      assert is_integer(counts["completed_today"])
    end

    test "execution entries have elapsed_seconds", %{conn: conn} do
      {:ok, _} =
        Ema.Executions.create(%{
          "title" => "Test dispatch task",
          "mode" => "implement",
          "status" => "created",
          "requires_approval" => true
        })

      conn = get(conn, "/api/dispatch-board")
      body = json_response(conn, 200)
      queued = body["queued"]

      if length(queued) > 0 do
        entry = hd(queued)
        assert Map.has_key?(entry, "elapsed_seconds")
        assert is_integer(entry["elapsed_seconds"])
      end
    end
  end

  describe "GET /api/dispatch-board/stats" do
    test "returns stats map", %{conn: conn} do
      conn = get(conn, "/api/dispatch-board/stats")
      body = json_response(conn, 200)
      assert is_integer(body["total"])
      assert is_integer(body["today"])
      assert is_integer(body["running"])
      assert is_integer(body["queued"])
      assert is_integer(body["completed_today"])
      assert is_integer(body["failed_today"])
      assert is_binary(body["last_updated_at"])
    end
  end
end
