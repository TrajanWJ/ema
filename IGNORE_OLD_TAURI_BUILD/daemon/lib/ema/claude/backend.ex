defmodule Ema.Claude.Backend do
  @moduledoc """
  Backend abstraction for the Claude Bridge.

  Uses the Claude Code CLI subprocess with full stream-json control,
  --plugin-dir for Citadel, session resume/fork, maximum control.

  ## Usage

      # Get spawn args for current backend
      Backend.spawn_config("analyze this code", session_id, "opus", opts)
  """

  use GenServer
  require Logger

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Get the current backend mode."
  def mode do
    :claude_cli
  end

  @doc "Switch backend mode at runtime."
  def set_mode(:claude_cli) do
    :ok
  end

  @doc "Get the executable and args for spawning a session."
  def spawn_config(prompt, session_id, model, project_dir, config) do
    GenServer.call(__MODULE__, {:spawn_config, prompt, session_id, model, project_dir, config})
  end

  @doc "Check if the current backend is available."
  def available? do
    System.find_executable("claude") != nil
  end

  @doc "Get backend-specific capabilities."
  def capabilities do
    %{
      streaming: true,
      session_resume: true,
      session_fork: true,
      plugin_dir: true,
      mcp_config: true,
      hooks_json: true,
      defer_resume: true,
      multi_turn: true,
      cost_tracking: true,
      output_format: "stream-json"
    }
  end

  # ── GenServer ──────────────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    Logger.info("[Backend] Initialized with mode: claude_cli")
    {:ok, %{mode: :claude_cli}}
  end

  @impl true
  def handle_call({:spawn_config, prompt, session_id, model, project_dir, config}, _from, state) do
    result = claude_cli_config(prompt, session_id, model, project_dir, config)
    {:reply, result, state}
  end

  # ── Claude CLI Backend ─────────────────────────────────────────────────────

  defp claude_cli_config(prompt, session_id, model, project_dir, config) do
    executable = System.find_executable(config[:claude_cmd] || "claude")

    args = [
      "--print",
      "--verbose",
      "--output-format",
      "stream-json",
      "--permission-mode",
      config[:permission_mode] || "bypassPermissions",
      "--session-id",
      session_id,
      "--model",
      model,
      "-p",
      prompt
    ]

    args = if config[:plugin_dir], do: args ++ ["--plugin-dir", config[:plugin_dir]], else: args
    args = if config[:mcp_config], do: args ++ ["--mcp-config", config[:mcp_config]], else: args

    args =
      if config[:allowed_tools],
        do: args ++ ["--allowed-tools", Enum.join(config[:allowed_tools], ",")],
        else: args

    env = [
      {~c"MCP_CONNECTION_NONBLOCKING", ~c"true"}
    ]

    port_opts = [
      :binary,
      :exit_status,
      :use_stdio,
      :stderr_to_stdout,
      {:env, env},
      {:args, args}
    ]

    port_opts = if project_dir, do: [{:cd, to_charlist(project_dir)} | port_opts], else: port_opts

    %{
      executable: executable,
      args: args,
      port_opts: port_opts,
      parser: :stream_json
    }
  end
end
