defmodule EmaWeb.CliManagerController do
  use EmaWeb, :controller

  alias Ema.CliManager
  alias Ema.CliManager.{Scanner, SessionRunner}

  action_fallback EmaWeb.FallbackController

  # -- Tools --

  def list_tools(conn, _params) do
    tools = CliManager.list_tools() |> Enum.map(&serialize_tool/1)
    json(conn, %{tools: tools})
  end

  def create_tool(conn, params) do
    case CliManager.create_tool(params) do
      {:ok, tool} -> json(conn, serialize_tool(tool))
      {:error, changeset} -> {:error, changeset}
    end
  end

  def scan(conn, _params) do
    tools = Scanner.scan() |> Enum.map(&serialize_tool/1)
    json(conn, %{tools: tools, count: length(tools)})
  end

  # -- Sessions --

  def list_sessions(conn, params) do
    opts =
      []
      |> maybe_put(:status, params["status"])
      |> maybe_put(:cli_tool_id, params["cli_tool_id"])
      |> maybe_put(:limit, parse_int(params["limit"]))

    sessions = CliManager.list_sessions(opts) |> Enum.map(&serialize_session/1)
    json(conn, %{sessions: sessions})
  end

  def create_session(conn, %{"tool_name" => tool_name, "project_path" => project_path, "prompt" => prompt} = params) do
    opts = Map.take(params, ["linked_task_id", "linked_proposal_id"])

    case SessionRunner.spawn_session(tool_name, project_path, prompt, opts) do
      {:ok, session} ->
        json(conn, serialize_session(CliManager.get_session(session.id)))

      {:error, :tool_not_found} ->
        conn |> put_status(404) |> json(%{error: "CLI tool not found"})

      {:error, reason} ->
        conn |> put_status(500) |> json(%{error: inspect(reason)})
    end
  end

  def create_session(conn, _params) do
    conn |> put_status(400) |> json(%{error: "tool_name, project_path, and prompt required"})
  end

  def stop_session(conn, %{"id" => id}) do
    case SessionRunner.stop(id) do
      :ok ->
        session = CliManager.get_session(id)
        json(conn, serialize_session(session))

      {:error, :not_running} ->
        case CliManager.stop_session(id) do
          {:ok, session} -> json(conn, serialize_session(session))
          {:error, :not_found} -> {:error, :not_found}
        end
    end
  end

  # -- Serialization --

  defp serialize_tool(tool) do
    %{
      id: tool.id,
      name: tool.name,
      binary_path: tool.binary_path,
      version: tool.version,
      capabilities: Ema.CliManager.CliTool.capabilities_list(tool),
      session_dir: tool.session_dir,
      detected_at: tool.detected_at,
      created_at: tool.inserted_at
    }
  end

  defp serialize_session(session) do
    %{
      id: session.id,
      cli_tool_id: session.cli_tool_id,
      tool_name: (session.cli_tool && session.cli_tool.name) || nil,
      project_path: session.project_path,
      status: session.status,
      pid: session.pid,
      prompt: session.prompt,
      started_at: session.started_at,
      ended_at: session.ended_at,
      linked_task_id: session.linked_task_id,
      linked_proposal_id: session.linked_proposal_id,
      output_summary: session.output_summary,
      exit_code: session.exit_code,
      created_at: session.inserted_at
    }
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(_), do: nil
end
