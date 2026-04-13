defmodule Ema.Claude.ClusterConfig do
  @moduledoc """
  Generates libcluster topology configuration for the EMA distributed mesh.

  Supports four discovery strategies:

  - `:local`     — Erlang EPMD on LAN (zero config, good for dev)
  - `:tailscale` — Named hosts on Tailscale network (best for multi-machine)
  - `:manual`    — Explicit node list (predictable, good for VPS clusters)
  - `:dns`       — DNS SRV/A-record-based discovery (good for k8s / Fly.io)

  ## Usage

      # In config/runtime.exs
      config :libcluster, topologies: Ema.Claude.ClusterConfig.topology()

      # Or dynamically at runtime:
      topologies = Ema.Claude.ClusterConfig.topology()
      {:ok, _pid} = Cluster.Supervisor.start_link(topologies, strategy: :one_for_one)

  ## Configuration

      config :ema, Ema.Claude.ClusterConfig,
        strategy: :tailscale,                  # :local | :tailscale | :manual | :dns
        app_name: "ema",                        # node name prefix (ema@hostname)
        tailscale_hosts: ["laptop", "server"],  # for :tailscale strategy
        manual_nodes: [:"ema@192.168.1.10"],   # for :manual strategy
        dns_query: "ema.internal",              # for :dns strategy
        dns_node_basename: "ema"                # for :dns strategy
  """

  require Logger

  @default_app_name "ema"

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc """
  Returns the libcluster topology keyword list suitable for:

      config :libcluster, topologies: Ema.Claude.ClusterConfig.topology()
  """
  def topology do
    strategy = config(:strategy, :local)
    build_topology(strategy)
  end

  @doc """
  Discovers EMA nodes on the Tailscale network by shelling out to `tailscale status`.

  Returns a list of node names like `[:"ema@laptop.tail1234.ts.net"]`.
  Filters to hosts that have the EMA app name in their hostname.
  """
  def tailscale_nodes do
    case System.find_executable("tailscale") do
      nil ->
        Logger.warning("[ClusterConfig] tailscale CLI not found — cannot discover nodes")
        []

      tailscale ->
        case System.cmd(tailscale, ["status", "--json"], stderr_to_stdout: false) do
          {json, 0} ->
            parse_tailscale_status(json)

          {output, code} ->
            Logger.warning("[ClusterConfig] tailscale status failed (exit #{code}): #{output}")
            []
        end
    end
  end

  @doc """
  Checks whether we can reach a given node name via net_adm.ping.

  Returns `:reachable` or `{:unreachable, :pang}`.
  """
  def validate_connectivity(node_name) when is_atom(node_name) do
    Logger.debug("[ClusterConfig] Pinging #{node_name}...")

    case :net_adm.ping(node_name) do
      :pong ->
        Logger.debug("[ClusterConfig] #{node_name} is reachable")
        :reachable

      :pang ->
        Logger.warning("[ClusterConfig] #{node_name} is NOT reachable")
        {:unreachable, :pang}
    end
  end

  @doc """
  Validates all nodes in the current topology, returns a map of results.
  """
  def validate_all do
    case topology() do
      [] ->
        %{}

      topologies ->
        nodes = extract_nodes_from_topology(topologies)
        Map.new(nodes, &{&1, validate_connectivity(&1)})
    end
  end

  # ---------------------------------------------------------------------------
  # Strategy builders
  # ---------------------------------------------------------------------------

  defp build_topology(:local) do
    Logger.info("[ClusterConfig] Using :local (EPMD) cluster strategy")

    [
      ema_local: [
        strategy: Cluster.Strategy.Epmd,
        config: [
          hosts: local_hosts()
        ]
      ]
    ]
  end

  defp build_topology(:tailscale) do
    Logger.info("[ClusterConfig] Using :tailscale cluster strategy")
    nodes = tailscale_node_list()

    [
      ema_tailscale: [
        strategy: Cluster.Strategy.Epmd,
        config: [
          hosts: nodes
        ]
      ]
    ]
  end

  defp build_topology(:manual) do
    nodes = config(:manual_nodes, [])
    Logger.info("[ClusterConfig] Using :manual cluster strategy with #{length(nodes)} nodes")

    [
      ema_manual: [
        strategy: Cluster.Strategy.Epmd,
        config: [
          hosts: nodes
        ]
      ]
    ]
  end

  defp build_topology(:dns) do
    query = config(:dns_query, "ema.internal")
    basename = config(:dns_node_basename, @default_app_name)
    Logger.info("[ClusterConfig] Using :dns cluster strategy, query=#{query}")

    [
      ema_dns: [
        strategy: Cluster.Strategy.DNSPoll,
        config: [
          query: query,
          node_basename: basename,
          polling_interval: 5_000
        ]
      ]
    ]
  end

  defp build_topology(unknown) do
    Logger.error("[ClusterConfig] Unknown strategy #{inspect(unknown)} — defaulting to :local")
    build_topology(:local)
  end

  # ---------------------------------------------------------------------------
  # Tailscale helpers
  # ---------------------------------------------------------------------------

  defp tailscale_node_list do
    # Prefer config-provided list; fall back to CLI discovery
    case config(:tailscale_hosts, []) do
      [] ->
        tailscale_nodes()

      hosts ->
        app = config(:app_name, @default_app_name)

        Enum.map(hosts, fn host ->
          :"#{app}@#{host}"
        end)
    end
  end

  defp parse_tailscale_status(json) do
    app = config(:app_name, @default_app_name)

    with {:ok, data} <- Jason.decode(json),
         peers when is_map(peers) <- Map.get(data, "Peer", %{}) do
      peers
      |> Map.values()
      |> Enum.filter(fn peer ->
        # Only include peers that are online and look like EMA nodes
        Map.get(peer, "Online", false) and
          peer
          |> Map.get("HostName", "")
          |> String.contains?(app)
      end)
      |> Enum.map(fn peer ->
        hostname = Map.get(peer, "DNSName", Map.get(peer, "HostName", ""))
        # Strip trailing dot from Tailscale DNS names
        hostname = String.trim_trailing(hostname, ".")
        :"#{app}@#{hostname}"
      end)
    else
      _ ->
        Logger.warning("[ClusterConfig] Could not parse tailscale status JSON")
        []
    end
  end

  # ---------------------------------------------------------------------------
  # Local EPMD helpers
  # ---------------------------------------------------------------------------

  defp local_hosts do
    # Auto-discover nodes registered with local EPMD, filter by app name
    app = config(:app_name, @default_app_name)

    case :erl_epmd.names() do
      {:ok, names} ->
        names
        |> Enum.filter(fn {name, _port} -> String.starts_with?(to_string(name), app) end)
        |> Enum.map(fn {name, _port} -> :"#{name}@#{hostname()}" end)

      _ ->
        [self_node()]
    end
  end

  defp self_node do
    Node.self()
  end

  defp hostname do
    {:ok, host} = :inet.gethostname()
    to_string(host)
  end

  # ---------------------------------------------------------------------------
  # Topology introspection
  # ---------------------------------------------------------------------------

  defp extract_nodes_from_topology(topologies) do
    topologies
    |> Keyword.values()
    |> Enum.flat_map(fn config ->
      config
      |> Keyword.get(:config, [])
      |> Keyword.get(:hosts, [])
    end)
  end

  # ---------------------------------------------------------------------------
  # Config helper
  # ---------------------------------------------------------------------------

  defp config(key, default) do
    :ema
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(key, default)
  end
end
