defmodule Ema.IntentionFarmer.Status do
  @moduledoc "Read-model for onboarding, import, and provider status."

  alias Ema.CliManager
  alias Ema.Claude.{ProviderRegistry, ProviderStatus}
  alias Ema.IntentionFarmer
  alias Ema.IntentionFarmer.{ImportCatalog, SourceRegistry}
  alias Ema.Settings

  def snapshot do
    sources = SourceRegistry.sources()
    harvest_stats = IntentionFarmer.stats()
    cli_tools = CliManager.list_tools()
    cli_sessions = CliManager.active_sessions()
    imports = ImportCatalog.list()
    providers = provider_statuses()
    connections = connection_status(cli_tools, cli_sessions, providers)

    readiness = readiness_summary(sources, cli_tools, providers, connections)

    %{
      checked_at: DateTime.utc_now() |> DateTime.truncate(:second),
      sources: source_counts(sources),
      imports: import_summary(imports),
      harvest: harvest_stats,
      bootstrap: bootstrap_summary(),
      providers: providers,
      cli_agents: %{
        tools_detected: length(cli_tools),
        active_sessions: length(cli_sessions),
        tool_names: Enum.map(cli_tools, & &1.name)
      },
      connections: connections,
      readiness: readiness
    }
  end

  def run_bootstrap do
    Ema.IntentionFarmer.StartupBootstrap.run()
  end

  defp source_counts(sources) do
    %{
      total_files: sources.total_files,
      claude_sessions: length(sources.claude_sessions || []),
      claude_tasks: length(sources.claude_tasks || []),
      codex_sessions: length(sources.codex_sessions || []),
      codex_history: length(sources.codex_history || []),
      import_sources: length(sources.import_sources || []),
      claude_mds: length(sources.claude_mds || [])
    }
  end

  defp bootstrap_summary do
    case Settings.get("onboarding.last_bootstrap") do
      nil ->
        %{last_bootstrap: nil}

      raw when is_binary(raw) ->
        case Jason.decode(raw) do
          {:ok, parsed} -> parsed
          _ -> %{last_bootstrap_raw: raw}
        end
    end
  end

  defp import_summary(imports) do
    %{
      total: length(imports),
      by_provider:
        imports
        |> Enum.frequencies_by(&Map.get(&1, "provider_guess", "external")),
      by_dataset:
        imports
        |> Enum.frequencies_by(&Map.get(&1, "dataset_guess", "generic_import")),
      recent:
        imports
        |> Enum.take(10)
    }
  end

  defp provider_statuses do
    providers =
      try do
        ProviderRegistry.list()
      rescue
        _ -> []
      catch
        :exit, _ -> []
      end

    Enum.map(providers, fn provider ->
      Map.merge(
        %{
          id: provider.id,
          type: provider.type,
          status: provider.status
        },
        ProviderStatus.execution_status(provider.id)
      )
    end)
  end

  defp connection_status(cli_tools, cli_sessions, providers) do
    healthy_provider_count =
      Enum.count(providers, fn provider ->
        provider[:status] in [:healthy, "healthy"]
      end)

    %{
      daemon_api: %{status: :ok, endpoint: "http://localhost:4488/api/health"},
      mcp_stdio: %{
        status: :ready,
        command: "cd /home/trajan/Projects/ema/daemon && mix ema.mcp.stdio"
      },
      cli_tools: %{
        detected: length(cli_tools),
        active_sessions: length(cli_sessions)
      },
      providers: %{
        configured: length(providers),
        healthy: healthy_provider_count
      }
    }
  end

  defp readiness_summary(sources, cli_tools, providers, connections) do
    healthy_provider? =
      Enum.any?(providers, fn provider ->
        provider[:status] in [:healthy, "healthy"]
      end)

    source_count = Map.get(sources, :total_files, 0)
    cli_tool_count = length(cli_tools)

    suggested_actions =
      []
      |> maybe_add(cli_tool_count == 0, "Run onboarding bootstrap to detect CLI agents and import sources.")
      |> maybe_add(source_count == 0, "Point EMA at real source directories before relying on harvested context.")
      |> maybe_add(not healthy_provider?, "Configure at least one healthy AI provider for active autonomous use.")

    %{
      ready_for_bootstrap: connections.mcp_stdio.status == :ready and connections.daemon_api.status == :ok,
      ready_for_active_use:
        connections.daemon_api.status == :ok and cli_tool_count > 0 and healthy_provider?,
      cli_tools_detected: cli_tool_count,
      healthy_provider_count: Enum.count(providers, &(&1[:status] in [:healthy, "healthy"])),
      source_file_count: source_count,
      suggested_actions: suggested_actions
    }
  end

  defp maybe_add(items, true, item), do: items ++ [item]
  defp maybe_add(items, false, _item), do: items
end
