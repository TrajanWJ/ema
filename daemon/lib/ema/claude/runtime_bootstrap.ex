defmodule Ema.Claude.RuntimeBootstrap do
  @moduledoc """
  Runtime discovery for local AI accounts, CLI tools, and distributed nodes.

  This keeps EMA's router/account-manager config aligned with the actual
  machine state instead of relying on static provider/account definitions.
  """

  alias Ema.Claude.Config

  @default_claude_paths ["~/.claude/.credentials.json", "~/.claude-work/.credentials.json"]
  @default_claude_models ["opus", "sonnet", "haiku"]
  @default_codex_models ["gpt-5.2-codex"]

  @spec build() :: %{providers: [map()], accounts: [map()], distribution: keyword()}
  def build do
    oauth_sources = discover_claude_oauth_sources()
    openclaw_node = build_openclaw_node()

    provider_defs =
      [
        build_claude_provider(oauth_sources),
        build_codex_provider(),
        build_openclaw_provider(openclaw_node)
      ]
      |> Enum.reject(&is_nil/1)

    %{
      providers: Enum.map(provider_defs, & &1.provider),
      accounts: Enum.flat_map(provider_defs, & &1.accounts),
      distribution: build_distribution(openclaw_node)
    }
  end

  defp build_claude_provider(oauth_sources) do
    claude_path = System.find_executable("claude")

    cond do
      oauth_sources != [] ->
        provider_accounts =
          Enum.map(oauth_sources, fn source ->
            %{name: source.name, auth: {:oauth, source.path}}
          end)

        provider = %{
          Config.build_provider(
            id: "claude-local",
            type: :claude_cli,
            name: "Claude Local",
            accounts: provider_accounts,
            models: @default_claude_models,
            capabilities: %{file_access: true, tool_use: true}
          )
          | cost_profile: %{opus: 0.015, sonnet: 0.003, haiku: 0.00025}
        }

        accounts =
          Enum.with_index(oauth_sources, 1)
          |> Enum.map(fn {source, priority} ->
            %{
              id: "claude-local:#{source.name}",
              provider_id: "claude-local",
              name: source.name,
              auth: %{type: :oauth, path: source.path, plan: source.plan, tier: source.tier},
              priority: priority
            }
          end)

        %{provider: provider, accounts: accounts}

      claude_path ->
        provider =
          Config.build_provider(
            id: "claude-local",
            type: :claude_cli,
            name: "Claude Local",
            accounts: [%{name: "system", auth: :system}],
            models: @default_claude_models
          )

        accounts = [
          %{
            id: "claude-local:system",
            provider_id: "claude-local",
            name: "system",
            auth: %{type: :system},
            priority: 1
          }
        ]

        %{provider: provider, accounts: accounts}

      true ->
        nil
    end
  end

  defp build_codex_provider do
    if System.find_executable("codex") do
      provider =
        Config.build_provider(
          id: "codex-local",
          type: :codex_cli,
          name: "Codex Local",
          accounts: [%{name: "system", auth: :system}],
          models: @default_codex_models
        )

      accounts = [
        %{
          id: "codex-local:system",
          provider_id: "codex-local",
          name: "system",
          auth: %{type: :system},
          priority: 1
        }
      ]

      %{provider: provider, accounts: accounts}
    end
  end

  defp build_openclaw_provider(nil), do: nil

  defp build_openclaw_provider(node) do
    provider =
      Config.build_provider(
        id: "openclaw-vm",
        type: :openclaw,
        name: "OpenClaw VM",
        accounts: [%{name: node[:id], auth: :system}],
        models: [],
        capabilities: %{web_search: true, tool_use: true, streaming: true}
      )

    accounts = [
      %{
        id: "openclaw-vm:#{node[:id]}",
        provider_id: "openclaw-vm",
        name: node[:id],
        auth: %{type: :system, ssh_host: node[:host], role: node[:role]},
        priority: 1
      }
    ]

    %{provider: provider, accounts: accounts}
  end

  defp discover_claude_oauth_sources do
    configured_paths =
      System.get_env("EMA_CLAUDE_OAUTH_PATHS")
      |> split_csv()
      |> case do
        [] -> @default_claude_paths
        paths -> paths
      end

    configured_paths
    |> Enum.map(&Path.expand/1)
    |> Enum.uniq()
    |> Enum.with_index(1)
    |> Enum.flat_map(fn {path, index} ->
      with true <- File.exists?(path),
           {:ok, json} <- File.read(path),
           {:ok, data} <- Jason.decode(json),
           %{} = oauth <- Map.get(data, "claudeAiOauth") do
        [
          %{
            path: path,
            name: source_name(path, index),
            plan: Map.get(oauth, "subscriptionType", "unknown"),
            tier: Map.get(oauth, "rateLimitTier", "unknown"),
            expires_at: Map.get(oauth, "expiresAt", 0)
          }
        ]
      else
        _ -> []
      end
    end)
    |> Enum.sort_by(fn source -> {source.name, -source.expires_at} end)
  end

  defp source_name(path, index) do
    base =
      path
      |> Path.dirname()
      |> Path.basename()
      |> String.replace_prefix(".", "")

    candidate =
      case base do
        "" -> "oauth-#{index}"
        ".claude" -> "personal"
        "claude" -> "personal"
        other -> other
      end

    candidate
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/u, "-")
    |> String.trim("-")
    |> case do
      "" -> "oauth-#{index}"
      name -> name
    end
  end

  defp build_openclaw_node do
    host = System.get_env("OPENCLAW_SSH_HOST", "localhost")

    if host == "" do
      nil
    else
      [
        id: System.get_env("EMA_OPENCLAW_NODE_ID", "agent-vm"),
        host: host,
        role: System.get_env("EMA_OPENCLAW_NODE_ROLE", "gateway"),
        weight: parse_integer(System.get_env("EMA_OPENCLAW_NODE_WEIGHT"), 100),
        providers: ["openclaw-vm"]
      ]
    end
  end

  defp build_distribution(openclaw_node) do
    extra_nodes = parse_nodes(System.get_env("EMA_CLAUDE_NODES", ""))
    nodes = Enum.reject([openclaw_node | extra_nodes], &is_nil/1)

    spaces = parse_org_spaces(System.get_env("EMA_CLAUDE_ORG_SPACES", ""))

    [
      enabled: env_truthy?("EMA_CLAUDE_DISTRIBUTED") or nodes != [],
      cluster_strategy: parse_cluster_strategy(System.get_env("EMA_CLAUDE_CLUSTER_STRATEGY")),
      tailscale_network: System.get_env("EMA_CLAUDE_TAILSCALE_NETWORK"),
      nodes: nodes,
      organization_spaces: spaces
    ]
  end

  defp parse_nodes(""), do: []

  defp parse_nodes(raw) do
    raw
    |> split_csv()
    |> Enum.map(fn node_def ->
      attrs =
        node_def
        |> String.split(";")
        |> Enum.map(&String.trim/1)
        |> Enum.reject(&(&1 == ""))
        |> Enum.map(fn part ->
          case String.split(part, "=", parts: 2) do
            [key, value] -> {String.trim(key), String.trim(value)}
            [key] -> {String.trim(key), ""}
          end
        end)
        |> Map.new()

      [
        id: Map.get(attrs, "id", "node"),
        host: Map.get(attrs, "host", "localhost"),
        role: Map.get(attrs, "role", "worker"),
        weight: parse_integer(Map.get(attrs, "weight"), 100),
        providers: split_pipe(Map.get(attrs, "providers", ""))
      ]
    end)
  end

  defp parse_org_spaces(""), do: %{}

  defp parse_org_spaces(raw) do
    raw
    |> split_csv()
    |> Enum.map(fn entry ->
      case String.split(entry, ":", parts: 2) do
        [org, spaces] -> {String.trim(org), split_pipe(spaces)}
        [org] -> {String.trim(org), []}
      end
    end)
    |> Enum.into(%{})
  end

  defp split_csv(nil), do: []

  defp split_csv(raw) do
    raw
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp split_pipe(raw) do
    raw
    |> String.split("|")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp env_truthy?(name) do
    case System.get_env(name) do
      value when value in ["1", "true", "TRUE", "yes", "on"] -> true
      _ -> false
    end
  end

  defp parse_integer(nil, default), do: default

  defp parse_integer(raw, default) do
    case Integer.parse(to_string(raw)) do
      {value, _} -> value
      :error -> default
    end
  end

  defp parse_cluster_strategy(nil), do: :tailscale
  defp parse_cluster_strategy(""), do: :tailscale

  defp parse_cluster_strategy(raw) do
    raw
    |> String.trim()
    |> String.downcase()
    |> case do
      "dns" -> :dns
      "kubernetes" -> :kubernetes
      "epmd" -> :epmd
      "gossip" -> :gossip
      _ -> :tailscale
    end
  end
end
