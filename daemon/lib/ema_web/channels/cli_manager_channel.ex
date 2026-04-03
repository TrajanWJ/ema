defmodule EmaWeb.CliManagerChannel do
  use Phoenix.Channel

  alias Ema.CliManager

  @topic "cli_manager:events"

  @impl true
  def join("cli_manager:lobby", _payload, socket) do
    send(self(), :subscribe)

    tools = CliManager.list_tools() |> Enum.map(&serialize_tool/1)
    sessions = CliManager.active_sessions() |> Enum.map(&serialize_session/1)

    {:ok, %{tools: tools, active_sessions: sessions}, socket}
  end

  @impl true
  def handle_info(:subscribe, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, @topic)
    {:noreply, socket}
  end

  def handle_info({:cli_manager, event, record}, socket) do
    case event do
      :session_created ->
        session = CliManager.get_session(record.id)
        push(socket, "session_created", serialize_session(session))

      :session_updated ->
        session = CliManager.get_session(record.id)
        push(socket, "session_updated", serialize_session(session))

      _ ->
        :ok
    end

    {:noreply, socket}
  end

  defp serialize_tool(tool) do
    %{
      id: tool.id,
      name: tool.name,
      binary_path: tool.binary_path,
      version: tool.version,
      capabilities: Ema.CliManager.CliTool.capabilities_list(tool)
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
      exit_code: session.exit_code
    }
  end
end
