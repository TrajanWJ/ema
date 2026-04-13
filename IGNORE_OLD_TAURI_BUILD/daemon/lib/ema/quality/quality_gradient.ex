defmodule Ema.Quality.QualityGradient do
  @moduledoc """
  Pure computation module for quality trend analysis.
  Compares metrics across time windows to detect improvement or degradation.
  """

  import Ecto.Query
  alias Ema.Repo

  @doc """
  Compute quality gradient comparing current vs prior window.
  Returns %{current: map, previous: map, gradient: map, trend: atom}.
  """
  def compute_gradient(window_days \\ 7) do
    now = DateTime.utc_now()
    window_start = DateTime.add(now, -window_days * 86400, :second)
    prev_start = DateTime.add(window_start, -window_days * 86400, :second)

    current = compute_metrics(window_start, now)
    previous = compute_metrics(prev_start, window_start)

    gradient = %{
      approval_rate: safe_subtract(current.approval_rate, previous.approval_rate),
      completion_rate: safe_subtract(current.completion_rate, previous.completion_rate)
    }

    composite_delta =
      (gradient.approval_rate + gradient.completion_rate) / 2.0

    trend =
      cond do
        composite_delta > 0.1 -> :improving
        composite_delta < -0.1 -> :degrading
        true -> :stable
      end

    %{
      current: current,
      previous: previous,
      gradient: gradient,
      trend: trend,
      window_days: window_days,
      computed_at: now
    }
  end

  defp compute_metrics(from_dt, to_dt) do
    %{
      approval_rate: proposal_approval_rate(from_dt, to_dt),
      completion_rate: task_completion_rate(from_dt, to_dt)
    }
  end

  defp proposal_approval_rate(from_dt, to_dt) do
    try do
      total =
        from(p in "proposals",
          where: p.inserted_at >= ^from_dt and p.inserted_at < ^to_dt,
          select: count(p.id)
        )
        |> Repo.one()

      approved =
        from(p in "proposals",
          where:
            p.inserted_at >= ^from_dt and p.inserted_at < ^to_dt and
              p.status == "approved",
          select: count(p.id)
        )
        |> Repo.one()

      if total > 0, do: Float.round(approved / total, 3), else: 0.0
    rescue
      _ -> 0.0
    end
  end

  defp task_completion_rate(from_dt, to_dt) do
    try do
      total =
        from(t in "tasks",
          where: t.inserted_at >= ^from_dt and t.inserted_at < ^to_dt,
          select: count(t.id)
        )
        |> Repo.one()

      done =
        from(t in "tasks",
          where:
            t.inserted_at >= ^from_dt and t.inserted_at < ^to_dt and
              t.status == "done",
          select: count(t.id)
        )
        |> Repo.one()

      if total > 0, do: Float.round(done / total, 3), else: 0.0
    rescue
      _ -> 0.0
    end
  end

  defp safe_subtract(a, b) when is_number(a) and is_number(b), do: Float.round(a - b, 3)
  defp safe_subtract(_, _), do: 0.0
end
