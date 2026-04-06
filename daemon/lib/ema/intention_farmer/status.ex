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

    %{
      checked_at: DateTime.utc_now() |> DateTime.truncate(:second),
      sources: source_counts(sources),
      imports: import_summary(imports),
      harvest: harvest_stats,
      bootstrap: bootstrap_summary(),
      providers: provider_statuses(),
      cli_agents: %{
        tools_detected: length(cli_tools),
        active_sessions: length(cli_sessions),
        tool_names: Enum.map(cli_tools, & &1.name)
      }
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
end
