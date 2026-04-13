defmodule Ema.Claude.Governance do
  @moduledoc """
  Audit logging for Claude Code tool calls.
  Inspired by Citadel's governance.js — observe-only, never blocks.

  Logs significant tool calls (Edit, Write, Bash, Agent) with timestamp,
  session_id, tool_name, and target. Skips noisy read-only tools.

  Stores to SQLite via Ecto and broadcasts via PubSub.
  """

  require Logger
  alias Ema.Repo

  @logged_tools ~w(Edit Write Bash Agent)
  @max_target_length 200

  @doc """
  Log a tool call to the audit trail.
  Called by Bridge when a tool_use event is parsed.
  """
  def log_tool_call(session_id, tool_name, tool_input) do
    if tool_name in @logged_tools do
      target = extract_target(tool_name, tool_input)

      attrs = %{
        session_id: session_id,
        tool_name: tool_name,
        target: truncate(target, @max_target_length),
        timestamp: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
      }

      # Async — governance must never slow down the session
      Task.start(fn ->
        insert_audit_log(attrs)

        Phoenix.PubSub.broadcast(Ema.PubSub, "claude:events", {:audit_log, attrs})
      end)
    end

    :ok
  end

  @doc """
  Log a session start event.
  """
  def log_session_start(session_id, model, project_dir) do
    attrs = %{
      session_id: session_id,
      tool_name: "_session_start",
      target: "model=#{model} dir=#{project_dir || "default"}",
      timestamp: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    }

    Task.start(fn -> insert_audit_log(attrs) end)
    :ok
  end

  @doc """
  Query recent audit logs.
  """
  def recent(limit \\ 50) do
    import Ecto.Query

    from(a in "claude_audit_logs",
      order_by: [desc: a.timestamp],
      limit: ^limit,
      select: %{
        session_id: a.session_id,
        tool_name: a.tool_name,
        target: a.target,
        timestamp: a.timestamp
      }
    )
    |> Repo.all()
  rescue
    _ -> []
  end

  @doc """
  Query audit logs for a specific session.
  """
  def for_session(session_id) do
    import Ecto.Query

    from(a in "claude_audit_logs",
      where: a.session_id == ^session_id,
      order_by: [asc: a.timestamp],
      select: %{
        tool_name: a.tool_name,
        target: a.target,
        timestamp: a.timestamp
      }
    )
    |> Repo.all()
  rescue
    _ -> []
  end

  # ── Private ────────────────────────────────────────────────────────────────

  defp extract_target(tool_name, input) when is_map(input) do
    case tool_name do
      t when t in ["Edit", "Write"] ->
        input["file_path"] || input["path"] || ""

      "Bash" ->
        input["command"] || ""

      "Agent" ->
        input["prompt"] || input["description"] || ""

      _ ->
        ""
    end
  end

  defp extract_target(_, _), do: ""

  defp truncate(str, max) when byte_size(str) > max do
    String.slice(str, 0, max - 3) <> "..."
  end

  defp truncate(str, _max), do: str

  defp insert_audit_log(attrs) do
    Repo.insert_all("claude_audit_logs", [attrs])
  rescue
    e ->
      Logger.debug("[Governance] Failed to insert audit log: #{inspect(e)}")
      :error
  end
end
