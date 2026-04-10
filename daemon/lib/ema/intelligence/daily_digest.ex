defmodule Ema.Intelligence.DailyDigest do
  @moduledoc """
  Generates a daily digest at a configurable time (default 9:00 UTC).

  On tick:
  1. Generates yesterday's recap via `Ema.Intelligence.Recap`
  2. Creates a brain dump item with the formatted digest
  3. Posts to babysitter Discord stream (if available)
  """

  use GenServer
  require Logger

  alias Ema.Intelligence.Recap

  @default_hour 9
  @check_interval_ms :timer.minutes(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force-generate and deliver the digest for yesterday, regardless of schedule."
  def generate_now do
    GenServer.call(__MODULE__, :generate_now)
  end

  @doc "Get the last digest that was generated."
  def last_digest do
    GenServer.call(__MODULE__, :last_digest)
  end

  # ── Callbacks ──

  @impl true
  def init(opts) do
    hour = Keyword.get(opts, :hour, @default_hour)
    schedule_check()

    {:ok,
     %{
       hour: hour,
       last_run_date: nil,
       last_digest: nil
     }}
  end

  @impl true
  def handle_info(:check, state) do
    today = Date.utc_today()
    now = DateTime.utc_now()

    state =
      if should_run?(now, state.hour, state.last_run_date, today) do
        run_digest(state, today)
      else
        state
      end

    schedule_check()
    {:noreply, state}
  end

  @impl true
  def handle_call(:generate_now, _from, state) do
    today = Date.utc_today()
    state = run_digest(state, today)
    {:reply, {:ok, state.last_digest}, state}
  end

  @impl true
  def handle_call(:last_digest, _from, state) do
    {:reply, state.last_digest, state}
  end

  # ── Internal ──

  defp should_run?(now, target_hour, last_run_date, today) do
    now.hour >= target_hour and last_run_date != today
  end

  defp run_digest(state, today) do
    Logger.info("[DailyDigest] Generating yesterday's digest")

    recap = Recap.generate(period: :yesterday)
    formatted = Recap.format(recap)

    # Strip ANSI for stored content
    plain = strip_ansi(formatted)

    # Create brain dump item with digest
    create_brain_dump(plain)

    # Post to babysitter if available
    post_to_babysitter(plain)

    %{state | last_run_date: today, last_digest: recap}
  end

  defp create_brain_dump(content) do
    attrs = %{
      content: "[Daily Digest] #{content}",
      source: "daily_digest"
    }

    case Ema.BrainDump.create_item_quiet(attrs) do
      {:ok, _item} ->
        Logger.info("[DailyDigest] Brain dump item created")

      {:error, reason} ->
        Logger.warning("[DailyDigest] Failed to create brain dump: #{inspect(reason)}")
    end
  end

  defp post_to_babysitter(content) do
    # Use apply/3 so the compiler doesn't statically reference an optional
    # module (Ema.Discord.Webhook may not be present in every build).
    webhook_mod = Module.concat(Ema.Discord, Webhook)

    try do
      if Code.ensure_loaded?(webhook_mod) and
           function_exported?(webhook_mod, :send_message, 2) do
        apply(webhook_mod, :send_message, [
          "daily-digest",
          "**Daily Digest — #{Date.utc_today() |> Date.to_iso8601()}**\n```\n#{content}\n```"
        ])
      end
    rescue
      _ -> :ok
    end
  end

  defp schedule_check do
    Process.send_after(self(), :check, @check_interval_ms)
  end

  defp strip_ansi(text) do
    Regex.replace(~r/\e\[[0-9;]*m/, text, "")
  end
end
