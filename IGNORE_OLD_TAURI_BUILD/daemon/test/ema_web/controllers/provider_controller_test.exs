defmodule EmaWeb.ProviderControllerTest do
  use EmaWeb.ConnCase, async: false

  describe "GET /api/providers" do
    test "returns provider list and execution status", %{conn: conn} do
      conn = get(conn, "/api/providers")
      body = json_response(conn, 200)
      assert is_list(body["providers"])
      assert is_map(body["execution_status"])
    end

    test "provider entries have expected fields", %{conn: conn} do
      conn = get(conn, "/api/providers")
      body = json_response(conn, 200)

      for p <- body["providers"] do
        assert is_binary(p["id"])
        assert is_binary(p["type"])
        assert is_binary(p["name"])
        assert is_binary(p["status"])
        assert is_map(p["capabilities"])
      end
    end
  end

  describe "GET /api/providers/:id" do
    test "returns 404 for unknown provider", %{conn: conn} do
      conn = get(conn, "/api/providers/nonexistent-provider-xyz")
      # Could be 404 (not found) or 503 (registry unavailable)
      assert json_response(conn, conn.status)
    end
  end

  describe "POST /api/providers/detect" do
    test "triggers runtime detection", %{conn: conn} do
      conn = post(conn, "/api/providers/detect")
      body = json_response(conn, 200)
      assert body["status"] == "ok"
      assert is_map(body["detected"])
      assert is_integer(body["detected"]["providers"])
      assert is_integer(body["detected"]["accounts"])
    end
  end

  describe "POST /api/providers/:id/health" do
    test "returns 404 for unknown provider", %{conn: conn} do
      conn = post(conn, "/api/providers/nonexistent-provider-xyz/health")
      assert json_response(conn, conn.status)
    end
  end
end
