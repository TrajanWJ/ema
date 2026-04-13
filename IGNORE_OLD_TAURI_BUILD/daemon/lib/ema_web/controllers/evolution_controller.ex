defmodule EmaWeb.EvolutionController do
  use EmaWeb, :controller

  alias Ema.Evolution

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:status, params["status"])
      |> maybe_put(:source, params["source"])
      |> maybe_put(:limit, parse_int(params["limit"]))

    rules = Evolution.list_rules(opts) |> Enum.map(&serialize_rule/1)
    json(conn, %{rules: rules})
  end

  def show(conn, %{"id" => id}) do
    case Evolution.get_rule(id) do
      nil -> {:error, :not_found}
      rule -> json(conn, %{rule: serialize_rule(rule)})
    end
  end

  def create(conn, params) do
    attrs = %{
      source: params["source"] || "manual",
      content: params["content"] || "",
      status: "proposed",
      signal_metadata: params["signal_metadata"] || %{}
    }

    with {:ok, rule} <- Evolution.create_rule(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize_rule(rule))
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Evolution.get_rule(id) do
      nil ->
        {:error, :not_found}

      rule ->
        attrs =
          %{}
          |> maybe_merge(:content, params["content"])
          |> maybe_merge(:status, params["status"])
          |> maybe_merge(:signal_metadata, params["signal_metadata"])

        with {:ok, updated} <- Evolution.update_rule(rule, attrs) do
          json(conn, serialize_rule(updated))
        end
    end
  end

  def activate(conn, %{"id" => id}) do
    with {:ok, rule} <- Evolution.activate_rule(id) do
      json(conn, serialize_rule(rule))
    end
  end

  def rollback(conn, %{"id" => id}) do
    with {:ok, rule} <- Evolution.rollback_rule(id) do
      json(conn, serialize_rule(rule))
    end
  end

  def apply_version(conn, %{"id" => id} = params) do
    new_content = params["content"] || ""

    with {:ok, rule} <- Ema.Evolution.Applier.apply_rule_version(id, new_content) do
      json(conn, serialize_rule(rule))
    end
  end

  def version_history(conn, %{"id" => id}) do
    with {:ok, chain} <- Evolution.get_version_history(id) do
      json(conn, %{versions: Enum.map(chain, &serialize_rule/1)})
    end
  end

  def signals(conn, params) do
    limit = parse_int(params["limit"]) || 20
    signals = Evolution.recent_signals(limit)
    json(conn, %{signals: signals})
  end

  def stats(conn, _params) do
    stats = Evolution.stats()

    scanner_status =
      try do
        Ema.Evolution.SignalScanner.status()
      rescue
        _ -> %{total_scans: 0, signals_detected: 0, last_scan_at: nil}
      end

    json(conn, %{
      rules: stats,
      scanner: scanner_status
    })
  end

  def scan_now(conn, _params) do
    Ema.Evolution.SignalScanner.scan_now()
    json(conn, %{status: "scan_triggered"})
  end

  def propose(conn, params) do
    instruction = params["instruction"] || ""

    Ema.Evolution.Proposer.propose_manual(instruction)

    conn
    |> put_status(:accepted)
    |> json(%{status: "proposal_queued", instruction: instruction})
  end

  # --- Private ---

  defp serialize_rule(rule) do
    %{
      id: rule.id,
      source: rule.source,
      content: rule.content,
      status: rule.status,
      version: rule.version,
      diff: rule.diff,
      signal_metadata: rule.signal_metadata,
      previous_rule_id: rule.previous_rule_id,
      proposal_id: rule.proposal_id,
      created_at: rule.inserted_at,
      updated_at: rule.updated_at
    }
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp maybe_merge(map, _key, nil), do: map
  defp maybe_merge(map, key, value), do: Map.put(map, key, value)

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(_), do: nil
end
