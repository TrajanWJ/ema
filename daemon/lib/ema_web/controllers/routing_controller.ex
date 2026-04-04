defmodule EmaWeb.RoutingController do
  use EmaWeb, :controller

  alias Ema.Routing.IntentRouter
  import Ecto.Query

  @doc """
  Classify a description without creating a task.
  POST /api/routing/classify
  Body: { description: "..." }
  Returns: { intent, recommended_agent, confidence, reasoning }
  """
  def classify(conn, %{"description" => description}) do
    result = IntentRouter.classify(description)

    reasoning =
      case result.confidence do
        :high -> "Classified as #{result.intent} based on keyword match"
        :low -> "No strong keyword match — defaulting to coder agent"
      end

    json(conn, %{
      intent: result.intent,
      recommended_agent: result.agent,
      confidence: result.confidence,
      reasoning: reasoning
    })
  end

  def classify(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "description is required"})
  end

  @doc """
  Routing stats — intent distribution, success rates, misroutes.
  GET /api/routing/stats
  """
  def stats(conn, _params) do
    alias Ema.Repo
    alias Ema.Tasks.Task

    by_intent =
      Task
      |> where([t], not is_nil(t.intent))
      |> group_by([t], t.intent)
      |> select([t], {t.intent, count(t.id)})
      |> Repo.all()
      |> Enum.map(fn {intent, count} ->
        success_count =
          Task
          |> where([t], t.intent == ^intent and t.status == "done")
          |> Repo.aggregate(:count, :id)

        success_rate = if count > 0, do: success_count / count, else: 0.0

        %{
          intent: intent,
          task_count: count,
          success_rate: Float.round(success_rate * 1.0, 2)
        }
      end)
      |> Enum.sort_by(& &1.task_count, :desc)

    most_common =
      case by_intent do
        [] -> nil
        [first | _] -> first.intent
      end

    misroute_count =
      Task
      |> where([t], t.intent_overridden == true)
      |> Repo.aggregate(:count, :id)

    json(conn, %{
      by_intent: by_intent,
      most_common_intent: most_common,
      misroute_count: misroute_count
    })
  end
end
