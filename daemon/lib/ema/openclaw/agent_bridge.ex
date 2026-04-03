defmodule Ema.OpenClaw.AgentBridge do
  @moduledoc """
  GenServer that polls the OpenClaw gateway for events and broadcasts them via PubSub.
  Uses periodic HTTP polling (gateway may not expose a WS endpoint).
  """

  use GenServer
  require Logger

  alias Ema.OpenClaw.Client

  @poll_interval 5_000
  @pubsub Ema.PubSub
  @topic "openclaw:events"

  # -- Public API --

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def connected? do
    GenServer.call(__MODULE__, :connected?)
  catch
    :exit, _ -> false
  end

  def status do
    GenServer.call(__MODULE__, :status)
  catch
    :exit, _ -> %{connected: false, last_check: nil, error: "bridge not running"}
  end

  def topic, do: @topic

  # -- GenServer callbacks --

  @impl true
  def init(_opts) do
    state = %{
      connected: false,
      last_check: nil,
      last_error: nil,
      sessions: []
    }

    send(self(), :poll)
    {:ok, state}
  end

  @impl true
  def handle_call(:connected?, _from, state) do
    {:reply, state.connected, state}
  end

  def handle_call(:status, _from, state) do
    {:reply,
     %{
       connected: state.connected,
       last_check: state.last_check,
       session_count: length(state.sessions),
       error: state.last_error
     }, state}
  end

  @impl true
  def handle_info(:poll, state) do
    new_state =
      case Client.get_status() do
        {:ok, _body} ->
          sessions =
            case Client.list_sessions() do
              {:ok, %{"sessions" => s}} -> s
              {:ok, s} when is_list(s) -> s
              _ -> state.sessions
            end

          if not state.connected do
            Logger.info("[OpenClaw] Connected to gateway")
            broadcast(:connected, %{})
          end

          %{state | connected: true, last_check: DateTime.utc_now(), last_error: nil, sessions: sessions}

        {:error, reason} ->
          if state.connected do
            Logger.warning("[OpenClaw] Lost connection: #{inspect(reason)}")
            broadcast(:disconnected, %{reason: inspect(reason)})
          end

          %{state | connected: false, last_check: DateTime.utc_now(), last_error: inspect(reason)}
      end

    Process.send_after(self(), :poll, @poll_interval)
    {:noreply, new_state}
  end

  defp broadcast(event, payload) do
    Phoenix.PubSub.broadcast(@pubsub, @topic, {:openclaw, event, payload})
  end
end
