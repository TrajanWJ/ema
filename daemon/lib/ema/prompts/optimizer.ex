defmodule Ema.Prompts.Optimizer do
  @moduledoc """
  Weekly prompt optimizer.

  Every Sunday at 02:00 UTC it:
    * finds underperforming prompts over the trailing 7 days
    * generates two improved variants through Claude
    * evaluates tests that have collected 7 days of data
  """

  use GenServer

  require Logger

  alias Ema.Claude.ExecutionBridge
  alias Ema.Prompts.Prompt
  alias Ema.Prompts.Store

  @name __MODULE__
  @seven_days 7 * 24 * 60 * 60

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, @name)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  def status(server \\ @name) do
    GenServer.call(server, :status)
  end

  def optimize(server \\ @name) do
    GenServer.cast(server, :optimize)
  end

  def next_run_after(now) do
    now = DateTime.truncate(now, :second)
    current_date = DateTime.to_date(now)
    days_until = rem(7 - Date.day_of_week(current_date, :sunday), 7)
    candidate_date = Date.add(current_date, days_until)
    candidate = DateTime.new!(candidate_date, ~T[02:00:00], "Etc/UTC")

    if DateTime.compare(candidate, now) == :gt do
      candidate
    else
      DateTime.add(candidate, 7 * 24 * 60 * 60, :second)
    end
  end

  def ms_until_next_run(now \\ DateTime.utc_now()) do
    next = next_run_after(now)
    max(DateTime.diff(next, now, :millisecond), 0)
  end

  @impl true
  def init(opts) do
    now = Keyword.get(opts, :now, DateTime.utc_now())
    next_run = next_run_after(now)

    {:ok,
     %{
       clock: Keyword.get(opts, :clock, &DateTime.utc_now/0),
       bridge_runner: Keyword.get(opts, :bridge_runner, &run_bridge/2),
       last_run: nil,
       next_run: next_run,
       timer_ref: schedule_tick(now)
     }}
  end

  @impl true
  def handle_call(:status, _from, state) do
    now = state.clock.()

    {:reply,
     %{
       last_run: format_datetime(state.last_run),
       next_run: format_datetime(state.next_run),
       active_tests: active_tests_payload(DateTime.add(now, -@seven_days, :second))
     }, state}
  end

  @impl true
  def handle_cast(:optimize, state) do
    {:noreply, run_optimization(state)}
  end

  @impl true
  def handle_info(:optimize, state) do
    {:noreply, run_optimization(state)}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp run_optimization(state) do
    now = state.clock.()
    since = DateTime.add(now, -@seven_days, :second)

    analyze_completed_tests(since)
    create_variants_for_underperformers(state.bridge_runner, since)

    maybe_cancel_timer(state.timer_ref)

    %{state |
      last_run: now,
      next_run: next_run_after(now),
      timer_ref: schedule_tick(now)}
  end

  defp analyze_completed_tests(since) do
    Store.active_tests()
    |> Enum.each(fn %{control: control, variants: variants} ->
      if control && test_ready?(variants, since) do
        resolve_test(control, variants, since)
      end
    end)
  end

  defp create_variants_for_underperformers(bridge_runner, since) do
    Store.prompts_below_success_rate(since)
    |> Enum.each(fn %{prompt: prompt, metrics: metrics} ->
      case generate_variants(prompt, metrics, bridge_runner) do
        {:ok, variants} ->
          metadata = %{
            optimizer_run_at: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601(),
            baseline_success_rate: metrics.success_rate,
            baseline_total: metrics.total
          }

          case Store.create_variants(prompt, variants, %{optimizer_metadata: metadata}) do
            {:ok, _} ->
              Logger.info("[Prompts.Optimizer] Created variants for #{prompt.kind} (#{prompt.id})")

            {:error, reason} ->
              Logger.warning("[Prompts.Optimizer] Failed storing variants for #{prompt.id}: #{inspect(reason)}")
          end

        {:error, reason} ->
          Logger.warning("[Prompts.Optimizer] Failed generating variants for #{prompt.id}: #{inspect(reason)}")
      end
    end)
  end

  defp generate_variants(prompt, metrics, bridge_runner) do
    optimization_prompt = """
    You are a prompt engineer. Given this system prompt and its performance metrics (success_rate: #{Float.round(metrics.success_rate * 100, 2)}%), generate 2 improved variants. Return JSON array of {variant_id, content, rationale}.

    System prompt:
    #{prompt.content}

    Metrics:
    #{Jason.encode!(%{success_rate: metrics.success_rate, total: metrics.total, successes: metrics.successes})}
    """

    with {:ok, response} <- bridge_runner.(optimization_prompt, prompt),
         {:ok, decoded} <- decode_variants(response) do
      {:ok, Enum.take(decoded, 2)}
    end
  end

  defp resolve_test(%Prompt{} = control, variants, since) do
    winner = Store.choose_test_winner(control, variants, since)

    if winner do
      Enum.each(variants, fn variant ->
        if variant.id == winner.prompt_id do
          Store.promote_prompt(variant)
        else
          Store.archive_prompt(variant)
        end
      end)

      if winner.prompt_id != control.id do
        Store.archive_prompt(control)
      end
    end
  end

  defp test_ready?(variants, since) do
    Enum.any?(variants, fn variant ->
      DateTime.compare(variant.inserted_at, since) in [:lt, :eq]
    end)
  end

  defp active_tests_payload(since) do
    Store.active_tests()
    |> Enum.map(fn %{prompt_id: prompt_id, control: control, variants: variants} ->
      %{
        prompt_id: prompt_id,
        variants:
          Enum.map(variants, fn variant ->
            %{
              id: variant.id,
              a_b_test_group: variant.a_b_test_group,
              status: variant.status
            }
          end),
        metrics: if(control, do: Store.test_metrics(control, variants, since), else: [])
      }
    end)
  end

  defp schedule_tick(now) do
    Process.send_after(self(), :optimize, ms_until_next_run(now))
  end

  defp maybe_cancel_timer(nil), do: :ok
  defp maybe_cancel_timer(timer_ref), do: Process.cancel_timer(timer_ref)

  defp format_datetime(nil), do: nil
  defp format_datetime(value), do: DateTime.to_iso8601(value)

  defp run_bridge(prompt, %Prompt{id: prompt_id, kind: kind}) do
    ExecutionBridge.run_sync(
      prompt,
      execution_id: "prompt_opt_#{prompt_id}",
      model: "sonnet",
      timeout: 300_000,
      project_path: File.cwd!(),
      proposal_id: nil
    )
    |> case do
      {:ok, response} ->
        Logger.debug("[Prompts.Optimizer] Claude returned optimization candidates for #{kind}")
        {:ok, response}

      {:error, _} = error ->
        error
    end
  end

  defp decode_variants(%{"result" => text}) when is_binary(text), do: decode_variants(text)
  defp decode_variants(%{"raw" => text}) when is_binary(text), do: decode_variants(text)

  defp decode_variants(text) when is_binary(text) do
    text
    |> String.trim()
    |> String.trim_leading("```json")
    |> String.trim_leading("```")
    |> String.trim_trailing("```")
    |> String.trim()
    |> Jason.decode()
  end

  defp decode_variants(other), do: {:error, {:unexpected_response, other}}
end
