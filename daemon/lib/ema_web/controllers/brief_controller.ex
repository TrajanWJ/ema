defmodule EmaWeb.BriefController do
  @moduledoc """
  REST endpoint for the EMA Brief — proactive structured snapshot of state,
  decisions, autonomous work, recommendations, upcoming items, and recent wins.
  """

  use EmaWeb, :controller

  alias Ema.Intelligence.Brief

  def show(conn, params) do
    opts =
      []
      |> maybe_put(:actor_id, params["actor_id"])
      |> maybe_put(:recommend_limit, parse_int(params["limit"]))

    json(conn, Brief.generate(opts))
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      _ -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(_), do: nil
end
