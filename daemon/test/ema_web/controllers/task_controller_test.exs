defmodule EmaWeb.TaskControllerTest do
  use EmaWeb.ConnCase, async: false

  alias Ema.Tasks

  setup do
    tmp_path =
      Path.join(
        System.tmp_dir!(),
        "ema-task-controller-#{System.unique_integer([:positive])}.json"
      )

    original = Application.get_env(:ema, :ema_tracker_path)
    Application.put_env(:ema, :ema_tracker_path, tmp_path)
    File.rm(tmp_path)

    start_supervised!(Ema.Intelligence.OutcomeTracker)

    on_exit(fn ->
      File.rm(tmp_path)

      case original do
        nil -> Application.delete_env(:ema, :ema_tracker_path)
        path -> Application.put_env(:ema, :ema_tracker_path, path)
      end
    end)

    :ok
  end

  test "stores scope advice in task metadata and exposes it from the API", %{conn: conn} do
    write_tracker([
      %{"agent" => "coder", "domain" => "backend", "status" => "failed"},
      %{"agent" => "coder", "domain" => "backend", "status" => "ok"},
      %{"agent" => "coder", "domain" => "backend", "status" => "timeout"},
      %{"agent" => "coder", "domain" => "backend", "status" => "ok"},
      %{"agent" => "coder", "domain" => "backend", "status" => "ok"}
    ])

    conn =
      post(conn, "/api/tasks", %{
        "title" => "Build endpoint",
        "agent" => "coder",
        "metadata" => %{"domain" => "backend"}
      })

    body = json_response(conn, 201)
    assert body["scope_advice"]["warn"] == true
    assert body["scope_advice"]["reason"] =~ "coder/backend"

    task = Tasks.get_task!(body["id"])
    assert task.metadata["scope_advice"]["warn"] == true

    conn = get(recycle(conn), "/api/tasks/#{task.id}/scope-advice")
    advice = json_response(conn, 200)["scope_advice"]
    assert advice["warn"] == true
    assert advice["reason"] =~ "coder/backend"
  end

  defp write_tracker(entries) do
    path = Application.fetch_env!(:ema, :ema_tracker_path)
    File.write!(path, Jason.encode!(entries))
  end
end
