defmodule EmaWeb.QualityController do
  @moduledoc """
  API controller for quality monitoring: friction, gradient, budget, threats.
  """

  use EmaWeb, :controller
  action_fallback EmaWeb.FallbackController

  alias Ema.Quality.{FrictionDetector, QualityGradient, BudgetLedger, ThreatModelAutomaton}

  @doc "GET /api/quality/report — combined quality report"
  def report(conn, _params) do
    json(conn, %{
      friction: serialize_friction(FrictionDetector.get_friction_report()),
      gradient: serialize_gradient(QualityGradient.compute_gradient()),
      budget: BudgetLedger.daily_summary(),
      threats: serialize_threats(ThreatModelAutomaton.last_report())
    })
  end

  @doc "GET /api/quality/friction"
  def friction(conn, _params) do
    json(conn, %{friction: serialize_friction(FrictionDetector.get_friction_report())})
  end

  @doc "GET /api/quality/gradient"
  def gradient(conn, _params) do
    json(conn, %{gradient: serialize_gradient(QualityGradient.compute_gradient())})
  end

  @doc "GET /api/quality/budget"
  def budget(conn, _params) do
    json(conn, %{budget: BudgetLedger.daily_summary()})
  end

  @doc "GET /api/quality/threats"
  def threats(conn, _params) do
    json(conn, %{threats: serialize_threats(ThreatModelAutomaton.last_report())})
  end

  defp serialize_friction(report) do
    %{
      friction_score: report.friction_score,
      severity: report.severity,
      signals: Enum.map(report.signals, &serialize_signal/1),
      scanned_at: report.scanned_at
    }
  end

  defp serialize_signal(signal) do
    %{
      type: signal.type,
      count: signal.count,
      weight: signal.weight
    }
  end

  defp serialize_gradient(gradient) do
    %{
      current: gradient.current,
      previous: gradient.previous,
      gradient: gradient.gradient,
      trend: gradient.trend,
      window_days: gradient.window_days,
      computed_at: gradient.computed_at
    }
  end

  defp serialize_threats(report) do
    %{
      findings: Enum.map(report.findings, &serialize_finding/1),
      checked_at: report.checked_at
    }
  end

  defp serialize_finding(finding) do
    %{
      type: finding.type,
      severity: finding.severity,
      message: finding.message,
      action: finding.action
    }
  end
end
