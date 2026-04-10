defmodule EmaWeb.GovernanceController do
  @moduledoc """
  Governance metrics endpoints.

  Routes:
    GET  /api/governance/sycophancy        — current pi + verdict + breakdown
    POST /api/governance/sycophancy/audit  — compute and broadcast alert if needed
  """

  use EmaWeb, :controller

  alias Ema.Governance.Sycophancy

  def sycophancy(conn, params) do
    lookback = parse_int(params["lookback_days"]) || 30
    result = Sycophancy.compute_pi(lookback)
    json(conn, serialize(result))
  end

  def sycophancy_audit(conn, params) do
    lookback = parse_int(params["lookback_days"]) || 30
    result = Sycophancy.audit_and_alert(lookback)
    json(conn, serialize(result))
  end

  defp serialize(result) do
    %{
      pi: result.pi,
      verdict: Atom.to_string(result.verdict),
      approved: result.approved,
      modified: result.modified,
      rejected: result.rejected,
      total: result.total,
      lookback_days: result.lookback_days,
      computed_at: result.computed_at
    }
  end

  defp parse_int(nil), do: nil
  defp parse_int(""), do: nil
  defp parse_int(n) when is_integer(n), do: n

  defp parse_int(s) when is_binary(s) do
    case Integer.parse(s) do
      {n, _} -> n
      :error -> nil
    end
  end
end
