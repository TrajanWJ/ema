defmodule EmaWeb.PipelineController do
  use EmaWeb, :controller

  alias Ema.Pipeline

  action_fallback EmaWeb.FallbackController

  def stats(conn, _params) do
    json(conn, Pipeline.get_pipeline_stats())
  end

  def bottlenecks(conn, _params) do
    json(conn, %{bottlenecks: Pipeline.get_bottlenecks()})
  end

  def throughput(conn, params) do
    period =
      case params["period"] do
        "hour" -> :hour
        "week" -> :week
        _ -> :day
      end

    json(conn, %{period: period, throughput: Pipeline.get_throughput(period)})
  end
end
