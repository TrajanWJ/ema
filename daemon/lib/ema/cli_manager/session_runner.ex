defmodule Ema.CliManager.SessionRunner do
  @moduledoc """
  GenServer that spawns and monitors CLI agent processes.
  Each running session gets a SessionRunner process.
  """

  use GenServer
  require Logger

  alias Ema.CliManager

  defstruct [:session_id, :port, :tool_name, :output_buffer]

  # -- Public API --

  def start_link(opts) do
    session_id = Keyword.fetch!(opts, :session_id)
    GenServer.start_link(__MODULE__, opts, name: via(session_id))
  end

  def stop(session_id) do
    case GenServer.whereis(via(session_id)) do
      nil -> {:error, :not_running}
      pid -> GenServer.call(pid, :stop)
    end
  end

  def running?(session_id) do
    GenServer.whereis(via(session_id)) != nil
  end

  defp via(session_id) do
    {:via, Registry, {Ema.CliManager.Registry, session_id}}
  end

  # -- Spawn a new CLI session --

  def spawn_session(tool_name, project_path, prompt, opts \\ %{}) do
    tool = CliManager.get_tool_by_name(tool_name)

    if tool == nil do
      {:error, :tool_not_found}
    else
      {:ok, session} =
        CliManager.create_session(%{
          "cli_tool_id" => tool.id,
          "project_path" => project_path,
          "prompt" => prompt,
          "linked_task_id" => opts["linked_task_id"],
          "linked_proposal_id" => opts["linked_proposal_id"]
        })

      case DynamicSupervisor.start_child(
             Ema.CliManager.RunnerSupervisor,
             {__MODULE__,
              session_id: session.id, tool: tool, project_path: project_path, prompt: prompt}
           ) do
        {:ok, _pid} ->
          {:ok, session}

        {:error, reason} ->
          CliManager.update_session(session, %{"status" => "crashed"})
          {:error, reason}
      end
    end
  end

  # -- GenServer callbacks --

  @impl true
  def init(opts) do
    session_id = Keyword.fetch!(opts, :session_id)
    tool = Keyword.fetch!(opts, :tool)
    project_path = Keyword.fetch!(opts, :project_path)
    prompt = Keyword.fetch!(opts, :prompt)

    {cmd, args} = build_command(tool.name, tool.binary_path, prompt)

    port =
      Port.open({:spawn_executable, cmd}, [
        :binary,
        :exit_status,
        :stderr_to_stdout,
        {:args, args},
        {:cd, project_path},
        {:env, []}
      ])

    os_pid = Port.info(port, :os_pid) |> elem(1)
    CliManager.update_session(CliManager.get_session(session_id), %{"pid" => os_pid})

    state = %__MODULE__{
      session_id: session_id,
      port: port,
      tool_name: tool.name,
      output_buffer: ""
    }

    {:ok, state}
  end

  @impl true
  def handle_call(:stop, _from, state) do
    Port.close(state.port)
    CliManager.stop_session(state.session_id)
    {:stop, :normal, :ok, state}
  rescue
    _ -> {:stop, :normal, :ok, state}
  end

  @impl true
  def handle_info({port, {:data, data}}, %{port: port} = state) do
    {:noreply, %{state | output_buffer: state.output_buffer <> data}}
  end

  def handle_info({port, {:exit_status, code}}, %{port: port} = state) do
    summary = state.output_buffer |> String.slice(-2000, 2000)
    CliManager.complete_session(state.session_id, code, summary)
    {:stop, :normal, state}
  end

  # -- Command builders --

  defp build_command("claude", binary, prompt) do
    {binary, ["--dangerously-skip-permissions", "-p", prompt]}
  end

  defp build_command("codex", binary, prompt) do
    {binary, ["--full-auto", prompt]}
  end

  defp build_command(_tool, binary, prompt) do
    {binary, [prompt]}
  end
end
