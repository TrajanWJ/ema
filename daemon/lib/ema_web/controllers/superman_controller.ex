defmodule EmaWeb.SupermanController do
  use EmaWeb, :controller

  alias Ema.Intelligence.SupermanClient
  alias Ema.Projects

  action_fallback EmaWeb.FallbackController

  def health(conn, _params) do
    case SupermanClient.health_check() do
      {:ok, body} -> json(conn, %{status: "connected", server: body})
      {:error, reason} -> json(conn, %{status: "disconnected", error: inspect(reason)})
    end
  end

  def status(conn, _params) do
    case SupermanClient.get_status() do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def index_repo(conn, %{"project_id" => project_id}) do
    with project when not is_nil(project) <- Projects.get_project(project_id),
         repo_path when not is_nil(repo_path) <- project.linked_path,
         {:ok, body} <- SupermanClient.index_repo(repo_path) do
      # Update project with indexed timestamp
      Projects.update_project(project, %{
        settings:
          Map.merge(project.settings || %{}, %{
            "superman_indexed_at" => DateTime.utc_now() |> DateTime.to_iso8601()
          })
      })

      json(conn, body)
    else
      nil -> {:error, :not_found}
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def index_repo(conn, %{"repo_path" => repo_path}) do
    case SupermanClient.index_repo(repo_path) do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def ask(conn, %{"query" => query} = params) do
    repo_path = params["repo_path"]

    case SupermanClient.ask_codebase(query, repo_path) do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def gaps(conn, _params) do
    case SupermanClient.get_gaps() do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def flows(conn, _params) do
    case SupermanClient.get_flows() do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def apply_change(conn, %{"instruction" => instruction}) do
    case SupermanClient.apply_task(instruction) do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def intent_graph(conn, _params) do
    case SupermanClient.get_intent_graph() do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def simulate(conn, %{"entry_point" => entry_point}) do
    case SupermanClient.simulate_flow(entry_point) do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def simulate(conn, _params) do
    case SupermanClient.simulate_flow(nil) do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def autonomous(conn, _params) do
    # Run async — return immediately with job reference
    task =
      Task.async(fn ->
        SupermanClient.autonomous_run()
      end)

    ref = inspect(task.ref)

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "superman:status",
      {:autonomous_started, ref}
    )

    json(conn, %{status: "started", job_ref: ref})
  end

  def panels(conn, _params) do
    case SupermanClient.get_panels() do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  def build(conn, %{"task" => task}) do
    case SupermanClient.build_task(task) do
      {:ok, body} -> json(conn, body)
      {:error, reason} -> conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end
end
