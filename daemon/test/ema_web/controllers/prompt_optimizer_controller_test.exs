defmodule EmaWeb.PromptOptimizerControllerTest do
  use EmaWeb.ConnCase, async: false

  alias Ema.Prompts.Store

  test "GET /api/prompts/optimizer/status returns optimizer status payload", %{conn: conn} do
    {:ok, control} = Store.create_prompt(%{kind: "controller_prompt_status", content: "control", a_b_test_group: "control"})

    {:ok, _variant} =
      Store.create_new_version("controller_prompt_status", "variant",
        a_b_test_group: "variant_A",
        status: "testing",
        control_prompt_id: control.id,
        parent_prompt_id: control.id
      )

    conn = get(conn, "/api/prompts/optimizer/status")
    body = json_response(conn, 200)

    assert Map.has_key?(body, "last_run")
    assert Map.has_key?(body, "next_run")
    assert is_list(body["active_tests"])
    assert Enum.any?(body["active_tests"], &(&1["prompt_id"] == control.id))
  end
end
