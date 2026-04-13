defmodule Mix.Tasks.Ema.Mcp.Stdio do
  use Mix.Task

  @compiled_endpoint_config Application.compile_env(:ema, EmaWeb.Endpoint, [])

  @shortdoc "Run EMA MCP server over clean stdio"

  @moduledoc """
  Starts EMA in a stdio-safe MCP mode.

  This task suppresses console logging before application startup so stdout
  can be reserved strictly for JSON-RPC frames.
  """

  @impl Mix.Task
  def run(_args) do
    Application.put_env(:logger, :backends, [])
    Application.put_env(:logger, :level, :error)
    Application.put_env(:logger, :default_handler, false)
    System.put_env("EMA_MCP_STDIO", "1")

    Mix.Task.run("app.config")

    endpoint_cfg =
      :ema
      |> Application.get_env(EmaWeb.Endpoint, [])
      |> Keyword.merge(@compiled_endpoint_config)
      |> Keyword.put(:code_reloader, false)

    Application.put_env(:ema, EmaWeb.Endpoint, endpoint_cfg)

    try do
      :logger.remove_handler(:default)
    rescue
      _ -> :ok
    catch
      _, _ -> :ok
    end

    repo_cfg = Application.get_env(:ema, Ema.Repo, [])
    repo_cfg = Keyword.merge(repo_cfg, log: false, stacktrace: false)
    Application.put_env(:ema, Ema.Repo, repo_cfg)

    {:ok, _} = Application.ensure_all_started(:ema)

    Ema.MCP.Server.run_stdio()
  end
end
