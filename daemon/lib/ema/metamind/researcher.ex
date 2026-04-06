defmodule Ema.MetaMind.Researcher do
  @moduledoc """
  Periodic process that discovers elite prompts and metaprompting techniques.
  Runs on a configurable schedule, finds high-performing patterns,
  and stores them in the prompt library.
  """

  use GenServer

  require Logger

  @default_interval_ms :timer.hours(6)
  @research_topics [
    "chain of thought prompting techniques",
    "few-shot learning prompt patterns",
    "system prompt best practices",
    "prompt injection defense techniques",
    "structured output prompting",
    "role-based prompt engineering",
    "meta-prompting and self-reflection patterns"
  ]

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Trigger an immediate research cycle."
  def research_now do
    GenServer.cast(__MODULE__, :research_now)
  end

  @doc "Get research stats."
  def stats do
    GenServer.call(__MODULE__, :stats)
  end

  @doc "Pause/resume the research schedule."
  def pause, do: GenServer.call(__MODULE__, :pause)
  def resume, do: GenServer.call(__MODULE__, :resume)

  # --- Server ---

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @default_interval_ms)
    timer_ref = schedule_tick(interval)

    {:ok,
     %{
       interval: interval,
       timer_ref: timer_ref,
       paused: false,
       last_run_at: nil,
       total_discoveries: 0,
       topics_researched: 0
     }}
  end

  @impl true
  def handle_cast(:research_now, state) do
    Task.Supervisor.start_child(Ema.MetaMind.TaskSupervisor, fn ->
      run_research_cycle()
    end)

    {:noreply, %{state | last_run_at: DateTime.utc_now()}}
  end

  @impl true
  def handle_call(:stats, _from, state) do
    {:reply, Map.take(state, [:paused, :last_run_at, :total_discoveries, :topics_researched]),
     state}
  end

  @impl true
  def handle_call(:pause, _from, state) do
    if state.timer_ref, do: Process.cancel_timer(state.timer_ref)
    {:reply, :ok, %{state | paused: true, timer_ref: nil}}
  end

  @impl true
  def handle_call(:resume, _from, state) do
    timer_ref = schedule_tick(state.interval)
    {:reply, :ok, %{state | paused: false, timer_ref: timer_ref}}
  end

  @impl true
  def handle_info(:tick, %{paused: true} = state) do
    {:noreply, state}
  end

  @impl true
  def handle_info(:tick, state) do
    Task.Supervisor.start_child(Ema.MetaMind.TaskSupervisor, fn ->
      run_research_cycle()
    end)

    timer_ref = schedule_tick(state.interval)

    {:noreply, %{state | timer_ref: timer_ref, last_run_at: DateTime.utc_now()}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_tick(interval) do
    Process.send_after(self(), :tick, interval)
  end

  defp run_research_cycle do
    topic = Enum.random(@research_topics)
    Logger.info("MetaMind Researcher: investigating '#{topic}'")

    prompt = """
    You are a prompt engineering researcher. Research the following topic and
    produce 2-3 high-quality, reusable prompt templates.

    ## Topic: #{topic}

    For each template, respond with JSON array:
    [
      {
        "name": "template name",
        "body": "the full prompt template with {{variable}} placeholders",
        "category": "technique",
        "tags": ["tag1", "tag2"],
        "template_vars": ["var1", "var2"],
        "rationale": "why this technique works"
      }
    ]
    """

    case Ema.Claude.Bridge.run(prompt, model: "haiku") do
      {:ok, results} when is_list(results) ->
        discoveries =
          Enum.map(results, fn template ->
            Ema.MetaMind.PromptLibrary.save_prompt(%{
              name: template["name"] || "Researched: #{topic}",
              body: template["body"] || "",
              category: template["category"] || "technique",
              tags: (template["tags"] || []) ++ ["researched", "auto-discovered"],
              template_vars: template["template_vars"] || [],
              metadata: %{
                "source" => "researcher",
                "topic" => topic,
                "rationale" => template["rationale"]
              }
            })
          end)

        saved = Enum.count(discoveries, &match?({:ok, _}, &1))
        Logger.info("MetaMind Researcher: saved #{saved} templates for '#{topic}'")

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "metamind:pipeline",
          {:metamind, :research_complete, %{topic: topic, discoveries: saved}}
        )

      {:ok, _other} ->
        Logger.warning("MetaMind Researcher: unexpected response format for '#{topic}'")

      {:error, reason} ->
        Logger.warning("MetaMind Researcher: failed for '#{topic}': #{inspect(reason)}")
    end
  end
end
