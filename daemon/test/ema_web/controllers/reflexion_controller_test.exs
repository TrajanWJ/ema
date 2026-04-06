defmodule EmaWeb.ReflexionControllerTest do
  use EmaWeb.ConnCase, async: false

  alias Ema.Intelligence.ReflexionStore

  describe "POST /api/reflexion/entries" do
    test "creates an entry", %{conn: conn} do
      conn =
        post(conn, "/api/reflexion/entries", %{
          agent: "claude",
          domain: "backend",
          project_slug: "ema",
          lesson: "Check existing route ordering before adding new API endpoints.",
          outcome_status: "success"
        })

      assert %{"entry" => entry} = json_response(conn, 201)
      assert entry["agent"] == "claude"
      assert entry["domain"] == "backend"
      assert entry["project_slug"] == "ema"
      assert entry["outcome_status"] == "success"
    end
  end

  describe "GET /api/reflexion/entries" do
    test "lists recent entries filtered by agent and domain", %{conn: conn} do
      assert {:ok, _} =
               ReflexionStore.record("claude", "backend", "ema", "Backend lesson", "success")

      assert {:ok, _} =
               ReflexionStore.record("claude", "frontend", "ema", "Frontend lesson", "success")

      conn = get(conn, "/api/reflexion/entries?agent=claude&domain=backend")

      assert %{"entries" => [entry]} = json_response(conn, 200)
      assert entry["lesson"] == "Backend lesson"
      assert entry["domain"] == "backend"
    end
  end
end
