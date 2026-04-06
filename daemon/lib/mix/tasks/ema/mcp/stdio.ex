defmodule Mix.Tasks.Ema.Mcp.Stdio do
  use Mix.Task

  @shortdoc "Run EMA MCP server over clean stdio"

  @moduledoc """
  Starts EMA in a stdio-safe MCP mode.

  This task suppresses console logging before application startup so stdout
  can be reserved strictly for JSON-RPC frames.
  """

  @impl Mix.Task
  def run(_args) do
    Application.put_env(:logger, :backends, [])
    System.put_env("EMA_MCP_STDIO", "1")

    Mix.Task.run("app.config")
    {:ok, _} = Application.ensure_all_started(:ema)

    Ema.MCP.Server.run_stdio()
  end
end
