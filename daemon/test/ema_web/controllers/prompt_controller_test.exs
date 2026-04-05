defmodule EmaWeb.PromptControllerTest do
  use EmaWeb.ConnCase, async: false

  alias Ema.Prompts.Store

  test "GET /api/prompts returns latest runtime prompts", %{conn: conn} do
    {:ok, _v1} = Store.create_prompt(%{kind: "controller_runtime_prompt", content: "v1"})
    {:ok, _v2} = Store.create_new_version("controller_runtime_prompt", "v2")

    conn = get(conn, "/api/prompts")
    body = json_response(conn, 200)

    prompt = Enum.find(body["prompts"], &(&1["kind"] == "controller_runtime_prompt"))
    assert prompt["version"] == 2
    assert prompt["content"] == "v2"
  end

  test "GET /api/prompts?all=true returns all prompt versions", %{conn: conn} do
    {:ok, _v1} = Store.create_prompt(%{kind: "controller_all_prompt", content: "v1"})
    {:ok, _v2} = Store.create_new_version("controller_all_prompt", "v2")

    conn = get(conn, "/api/prompts?all=true")
    body = json_response(conn, 200)

    matches = Enum.filter(body["prompts"], &(&1["kind"] == "controller_all_prompt"))
    assert length(matches) == 2
  end

  test "POST /api/prompts/:id/version creates a new version", %{conn: conn} do
    {:ok, prompt} = Store.create_prompt(%{kind: "controller_version_prompt", content: "base"})

    conn = post(conn, "/api/prompts/#{prompt.id}/version", %{content: "next"})
    body = json_response(conn, 201)

    assert body["prompt"]["kind"] == "controller_version_prompt"
    assert body["prompt"]["version"] == 2
    assert body["prompt"]["content"] == "next"
  end
end
