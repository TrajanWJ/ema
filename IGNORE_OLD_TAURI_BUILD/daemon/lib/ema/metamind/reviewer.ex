defmodule Ema.MetaMind.Reviewer do
  @moduledoc """
  Spawns domain-expert sub-agents that each review and suggest improvements
  to prompts. Experts run in parallel via Task.Supervisor.
  """

  use GenServer

  require Logger

  @experts %{
    technical: %{
      name: "Technical Reviewer",
      focus: "code quality, architecture, technical accuracy, API usage",
      system: """
      You are a technical review expert. Analyze the prompt for:
      - Technical accuracy and completeness
      - Missing context that would improve code output
      - Ambiguous requirements that need clarification
      - Security considerations
      Respond with JSON: {"score": 0.0-1.0, "suggestions": ["..."], "revised_section": "..."}
      """
    },
    creative: %{
      name: "Creative Reviewer",
      focus: "clarity, engagement, framing, prompt engineering best practices",
      system: """
      You are a prompt engineering expert. Analyze the prompt for:
      - Clarity and specificity of instructions
      - Effective use of examples and constraints
      - Optimal framing and structure
      - Missing context or role-setting
      Respond with JSON: {"score": 0.0-1.0, "suggestions": ["..."], "revised_section": "..."}
      """
    },
    business: %{
      name: "Business Reviewer",
      focus: "alignment with goals, ROI, stakeholder needs, scope",
      system: """
      You are a business alignment reviewer. Analyze the prompt for:
      - Alignment with likely business objectives
      - Scope appropriateness
      - Missing success criteria
      - Stakeholder perspective gaps
      Respond with JSON: {"score": 0.0-1.0, "suggestions": ["..."], "revised_section": "..."}
      """
    },
    security: %{
      name: "Security Reviewer",
      focus: "prompt injection risks, data leakage, safety boundaries",
      system: """
      You are a security reviewer for AI prompts. Analyze the prompt for:
      - Prompt injection vulnerabilities
      - Data leakage risks
      - Missing safety boundaries
      - Overly permissive instructions
      Respond with JSON: {"score": 0.0-1.0, "suggestions": ["..."], "revised_section": "..."}
      """
    }
  }

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Run all domain experts on a prompt in parallel. Returns merged reviews."
  def review(prompt, opts \\ []) do
    GenServer.call(__MODULE__, {:review, prompt, opts}, 120_000)
  end

  @doc "Get configured experts."
  def experts, do: @experts

  @doc "Get review history stats."
  def stats do
    GenServer.call(__MODULE__, :stats)
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    {:ok,
     %{
       total_reviews: 0,
       reviews_by_expert: Map.new(Map.keys(@experts), &{&1, 0}),
       avg_scores: Map.new(Map.keys(@experts), &{&1, 0.0})
     }}
  end

  @impl true
  def handle_call({:review, prompt, opts}, _from, state) do
    selected_experts =
      case Keyword.get(opts, :experts) do
        nil -> Map.keys(@experts)
        list -> Enum.filter(list, &Map.has_key?(@experts, &1))
      end

    tasks =
      Enum.map(selected_experts, fn expert_key ->
        expert = @experts[expert_key]

        Task.Supervisor.async(Ema.MetaMind.TaskSupervisor, fn ->
          run_expert(expert_key, expert, prompt)
        end)
      end)

    results =
      tasks
      |> Task.yield_many(60_000)
      |> Enum.zip(selected_experts)
      |> Enum.map(fn {{task, result}, expert_key} ->
        case result do
          {:ok, review} ->
            {expert_key, review}

          nil ->
            Task.shutdown(task, :brutal_kill)
            {expert_key, %{score: 0.0, suggestions: ["Review timed out"], revised_section: nil}}
        end
      end)
      |> Map.new()

    state = update_stats(state, results)

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "metamind:pipeline",
      {:metamind, :reviewed, %{prompt: prompt, reviews: results}}
    )

    {:reply, {:ok, results}, state}
  end

  @impl true
  def handle_call(:stats, _from, state) do
    {:reply, Map.take(state, [:total_reviews, :reviews_by_expert, :avg_scores]), state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp run_expert(expert_key, expert, prompt) do
    review_prompt = """
    ## Expert Role: #{expert.name}
    ## Focus Areas: #{expert.focus}

    ## Prompt to Review:
    #{prompt}

    Provide your review as JSON.
    """

    case Ema.Claude.Bridge.run(review_prompt, model: "haiku") do
      {:ok, result} ->
        %{
          expert: expert_key,
          name: expert.name,
          score: parse_float(result["score"], 0.5),
          suggestions: result["suggestions"] || [],
          revised_section: result["revised_section"]
        }

      {:error, reason} ->
        Logger.warning("Reviewer: #{expert.name} failed: #{inspect(reason)}")

        %{
          expert: expert_key,
          name: expert.name,
          score: 0.0,
          suggestions: ["Expert review failed: #{inspect(reason)}"],
          revised_section: nil
        }
    end
  end

  defp parse_float(val, _default) when is_float(val), do: val
  defp parse_float(val, _default) when is_integer(val), do: val / 1.0

  defp parse_float(val, default) when is_binary(val) do
    case Float.parse(val) do
      {f, _} -> f
      :error -> default
    end
  end

  defp parse_float(_, default), do: default

  defp update_stats(state, results) do
    reviews_by_expert =
      Enum.reduce(results, state.reviews_by_expert, fn {key, _review}, acc ->
        Map.update(acc, key, 1, &(&1 + 1))
      end)

    avg_scores =
      Enum.reduce(results, state.avg_scores, fn {key, review}, acc ->
        count = reviews_by_expert[key]
        old_avg = state.avg_scores[key]
        new_avg = old_avg + (review.score - old_avg) / count
        Map.put(acc, key, Float.round(new_avg, 3))
      end)

    %{
      state
      | total_reviews: state.total_reviews + 1,
        reviews_by_expert: reviews_by_expert,
        avg_scores: avg_scores
    }
  end
end
