defmodule EmaWeb.MetricsController do
  use EmaWeb, :controller

  def summary(conn, _params) do
    json(conn, Ema.Metrics.summary())
  end

  def by_domain(conn, _params) do
    json(conn, %{domains: Ema.Metrics.by_domain()})
  end
end
