defmodule Ema.Claude.Backend do
  @moduledoc """
  Backend abstraction for the Claude Bridge.

  Supports two modes:
  - `:claude_cli` — Direct Claude Code CLI subprocess (default)
  - `:openclaw` — Route through OpenClaw gateway (ACP protocol)

  Switch at runtime via `Backend.set_mode/1` or configure in config.exs.

  ## Why Two Modes?

  **Claude CLI** — Direct subprocess, full stream-json control, --plugin-dir
  for Citadel, session resume/fork, maximum control. Best for local dev
  where you want raw access to Claude Code's features.

  **OpenClaw** — Routes through the OpenClaw gateway which manages sessions,
  provides its own hook system, MCP bridges, multi-channel output, and
  persistent agent sessions. Better for production/daemon use where EMA
  is one of many consumers of Claude.

  ## Usage

      # Check current mode
      Backend.mode()
      # => :claude_cli

      # Switch modes
      Backend.set_mode(:openclaw)

      # Get spawn args for current backend
      Backend.spawn_args("analyze this code", session_id, "opus", opts)
  """

  use GenServer
  require Logger

  @default_mode :claude_cli

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Get the current backend mode."
  def mode do
    GenServer.call(__MODULE__, :mode)
  end

  @doc "Switch backend mode at runtime."
  def set_mode(mode) when mode in [:claude_cli, :openclaw] do
    GenServer.call(__MODULE__, {:set_mode, mode})
  end

  @doc "Get the executable and args for spawning a session."
  def spawn_config(prompt, session_id, model, project_dir, config) do
    GenServer.call(__MODULE__, {:spawn_config, prompt, session_id, model, project_dir, config})
  end

  @doc "Check if the current backend is available."
  def available? do
    GenServer.call(__MODULE__, :available?)
  end

  @doc "Get backend-specific capabilities."
  def capabilities do
    GenServer.call(__MODULE__, :capabilities)
  end

  # ── GenServer ──────────────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    mode = Keyword.get(opts, :mode, Application.get_env(:ema, :claude_backend, @default_mode))
    Logger.info("[Backend] Initialized with mode: #{mode}")
    {:ok, %{mode: mode}}
  end

  @impl true
  def handle_call(:mode, _from, state) do
    {:reply, state.mode, state}
  end

  @impl true
  def handle_call({:set_mode, mode}, _from, state) do
    Logger.info("[Backend] Switching mode: #{state.mode} → #{mode}")
    {:reply, :ok, %{state | mode: mode}}
  end

  @impl true
  def handle_call({:spawn_config, prompt, session_id, model, project_dir, config}, _from, state) do
    result =
      case state.mode do
        :claude_cli -> claude_cli_config(prompt, session_id, model, project_dir, config)
        :openclaw -> openclaw_config(prompt, session_id, model, project_dir, config)
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:available?, _from, state) do
    result =
      case state.mode do
        :claude_cli -> System.find_executable("claude") != nil
        :openclaw -> System.find_executable("openclaw") != nil
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:capabilities, _from, state) do
    caps =
      case state.mode do
        :claude_cli ->
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

        :openclaw ->
          %{
            streaming: true,
            session_resume: true,
            session_fork: false,
            plugin_dir: false,
            mcp_config: true,
            hooks_json: false,
            defer_resume: false,
            multi_turn: true,
            cost_tracking: true,
            output_format: "stream-json",
            # OpenClaw-specific extras
            discord_output: true,
            telegram_output: true,
            multi_channel: true,
            persistent_sessions: true,
            lcm_context: true,
            subagent_spawn: true
          }
      end

    {:reply, caps, state}
  end

  # ── Claude CLI Backend ─────────────────────────────────────────────────────

  defp claude_cli_config(prompt, session_id, model, project_dir, config) do
    executable = System.find_executable(config[:claude_cmd] || "claude")

    args = [
      "--print",
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

  # ── OpenClaw Backend ───────────────────────────────────────────────────────

  defp openclaw_config(prompt, session_id, model, _project_dir, config) do
    executable = System.find_executable("openclaw")

    # OpenClaw agent CLI — spawns a session via the gateway
    args = [
      "agent",
      "run",
      "--print",
      "--output-format",
      "stream-json",
      "--session-id",
      session_id,
      "--model",
      resolve_openclaw_model(model),
      "--prompt",
      prompt
    ]

    # OpenClaw-specific options
    args = if config[:agent_id], do: args ++ ["--agent", config[:agent_id]], else: args
    args = if config[:mcp_config], do: args ++ ["--mcp-config", config[:mcp_config]], else: args

    env = [
      {~c"OPENCLAW_GATEWAY_URL", to_charlist(config[:gateway_url] || "http://localhost:18789")}
    ]

    port_opts = [
      :binary,
      :exit_status,
      :use_stdio,
      :stderr_to_stdout,
      {:env, env},
      {:args, args}
    ]

    %{
      executable: executable,
      args: args,
      port_opts: port_opts,
      parser: :stream_json
    }
  end

  # Map EMA model names to OpenClaw model aliases
  defp resolve_openclaw_model("opus"), do: "anthropic/claude-opus-4-6"
  defp resolve_openclaw_model("sonnet"), do: "anthropic/claude-sonnet-4-20250514"
  defp resolve_openclaw_model("haiku"), do: "anthropic/claude-haiku-3-5-20241022"
  defp resolve_openclaw_model(model), do: model
end
