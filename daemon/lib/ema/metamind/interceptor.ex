defmodule Ema.MetaMind.Interceptor do
  @moduledoc """
  GenServer that intercepts all outbound Claude CLI calls.
  Before any prompt goes to Claude, it passes through the review pipeline.
  Maintains a queue of pending prompts and their review states.
  """

  use GenServer

  require Logger

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Submit a prompt for review before dispatch to Claude."
  def intercept(prompt, opts \\ []) do
    GenServer.call(__MODULE__, {:intercept, prompt, opts}, :infinity)
  end

  @doc "Bypass review and dispatch directly (for system-level prompts)."
  def passthrough(prompt, opts \\ []) do
    Ema.Claude.Bridge.run(prompt, opts)
  end

  @doc "Get current interception stats."
  def stats do
    GenServer.call(__MODULE__, :stats)
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    {:ok,
     %{
       total_intercepted: 0,
       total_approved: 0,
       total_modified: 0,
       total_bypassed: 0,
       pending: %{}
     }}
  end

  @impl true
  def handle_call({:intercept, prompt, opts}, from, state) do
    intercept_id = Ecto.UUID.generate()

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "metamind:pipeline",
      {:metamind, :intercepted, %{id: intercept_id, prompt: prompt, opts: opts}}
    )

    Task.Supervisor.start_child(Ema.MetaMind.TaskSupervisor, fn ->
      result = Ema.MetaMind.Pipeline.run(prompt, intercept_id: intercept_id)
      GenServer.cast(__MODULE__, {:review_complete, intercept_id, from, result, opts})
    end)

    pending = Map.put(state.pending, intercept_id, %{prompt: prompt, from: from, started_at: DateTime.utc_now()})
    {:noreply, %{state | total_intercepted: state.total_intercepted + 1, pending: pending}}
  end

  @impl true
  def handle_call(:stats, _from, state) do
    stats = Map.take(state, [:total_intercepted, :total_approved, :total_modified, :total_bypassed])
    {:reply, stats, state}
  end

  @impl true
  def handle_cast({:review_complete, intercept_id, from, result, opts}, state) do
    {revised_prompt, was_modified} =
      case result do
        {:ok, %{revised_prompt: revised}} -> {revised, true}
        {:ok, %{original_prompt: original}} -> {original, false}
        {:error, _reason} -> {state.pending[intercept_id][:prompt], false}
      end

    Task.Supervisor.start_child(Ema.MetaMind.TaskSupervisor, fn ->
      response = Ema.Claude.Bridge.run(revised_prompt, opts)
      GenServer.reply(from, response)
    end)

    state =
      if was_modified,
        do: %{state | total_modified: state.total_modified + 1},
        else: %{state | total_approved: state.total_approved + 1}

    {:noreply, %{state | pending: Map.delete(state.pending, intercept_id)}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}
end
