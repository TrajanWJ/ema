defmodule Ema.MCP.StdioRunner do
  @moduledoc false

  require Logger

  @compiled_ecto_repos Application.compile_env(:ema, :ecto_repos, [Ema.Repo])
  @compiled_ai_backend Application.compile_env(:ema, :ai_backend, :bridge)
  @compiled_vault_path Application.compile_env(:ema, :vault_path, "/home/trajan/vault")
  @compiled_endpoint_config Application.compile_env(:ema, EmaWeb.Endpoint, [])
  @compiled_repo_config Application.compile_env(:ema, Ema.Repo, [])

  def run do
    Application.ensure_all_started(:mix)
    Mix.start()

    Application.put_env(:logger, :backends, [])
    Application.put_env(:logger, :level, :error)
    Application.put_env(:logger, :default_handler, false)
    System.put_env("EMA_MCP_STDIO", "1")

    Logger.configure(level: :error)

    with backends when is_list(backends) <- Application.get_env(:logger, :backends, []),
         true <- :console in backends do
      Logger.remove_backend(:console, flush: true)
    end

    try do
      :logger.remove_handler(:default)
    rescue
      _ -> :ok
    catch
      _, _ -> :ok
    end

    Application.load(:ema)
    Application.put_env(:ema, :ecto_repos, @compiled_ecto_repos)
    Application.put_env(:ema, :ai_backend, @compiled_ai_backend)
    Application.put_env(:ema, :vault_path, @compiled_vault_path)

    Application.put_env(
      :ema,
      EmaWeb.Endpoint,
      Keyword.put(@compiled_endpoint_config, :code_reloader, false)
    )

    repo_cfg = Keyword.merge(@compiled_repo_config, log: false, stacktrace: false)
    Application.put_env(:ema, Ema.Repo, repo_cfg)

    {:ok, _} = Application.ensure_all_started(:ema)
    Ema.MCP.Server.run_stdio()
  end
end
