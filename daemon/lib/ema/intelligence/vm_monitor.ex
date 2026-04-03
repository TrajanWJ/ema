defmodule Ema.Intelligence.VmMonitor do
  @moduledoc """
  GenServer that polls local tool availability every 30s.
  Checks that the `claude` CLI is reachable and the daemon itself is healthy.
  Broadcasts health status via PubSub (same topics/formats as before).
  """

  use GenServer
  require Logger

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Intelligence.VmHealthEvent

  @poll_interval :timer.seconds(30)

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Get the latest health snapshot."
  def current_health do
    VmHealthEvent
    |> order_by([e], desc: e.checked_at)
    |> limit(1)
    |> Repo.one()
  end

  @doc "Get recent health events."
  def recent_events(limit \\ 50) do
    VmHealthEvent
    |> order_by([e], desc: e.checked_at)
    |> limit(^limit)
    |> Repo.all()
  end

  @doc "Force an immediate health check."
  def check_now do
    GenServer.cast(__MODULE__, :check)
  end

  @doc "Get parsed containers from the latest event."
  def containers do
    case current_health() do
      nil -> []
      event -> parse_containers(event.containers_json)
    end
  end

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    schedule_poll()
    {:ok, %{last_status: "unknown"}}
  end

  @impl true
  def handle_info(:poll, state) do
    state = do_check(state)
    schedule_poll()
    {:noreply, state}
  end

  @impl true
  def handle_cast(:check, state) do
    {:noreply, do_check(state)}
  end

  # --- Internal ---

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval)
  end

  defp do_check(state) do
    start = System.monotonic_time(:millisecond)

    claude_available = check_claude_cli()
    daemon_healthy = check_daemon_health()
    openclaw_available = check_local_openclaw()

    total_latency = System.monotonic_time(:millisecond) - start

    status =
      cond do
        claude_available and daemon_healthy -> "online"
        daemon_healthy -> "degraded"
        true -> "offline"
      end

    # openclaw_up reflects whether we have any agent backend available
    openclaw_up = openclaw_available or claude_available

    attrs = %{
      id: Ecto.UUID.generate(),
      status: status,
      openclaw_up: openclaw_up,
      ssh_up: true,
      containers_json: "[]",
      latency_ms: round(total_latency),
      checked_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }

    case %VmHealthEvent{} |> VmHealthEvent.changeset(attrs) |> Repo.insert() do
      {:ok, event} ->
        if status != state.last_status do
          broadcast(:vm_status_changed, %{status: status, previous: state.last_status})
        end

        broadcast(:vm_health_checked, %{
          status: status,
          openclaw_up: openclaw_up,
          ssh_up: true,
          latency_ms: event.latency_ms
        })

      {:error, reason} ->
        Logger.warning("VmMonitor: failed to store health event: #{inspect(reason)}")
    end

    %{state | last_status: status}
  end

  defp check_claude_cli do
    System.find_executable("claude") != nil
  end

  defp check_daemon_health do
    # Self-check: verify the Ecto repo and PubSub are alive
    is_pid(Process.whereis(Ema.Repo)) and is_pid(Process.whereis(Ema.PubSub))
  end

  defp check_local_openclaw do
    System.find_executable("openclaw") != nil
  end

  defp parse_containers(json_str) do
    case Jason.decode(json_str || "[]") do
      {:ok, list} when is_list(list) -> list
      _ -> []
    end
  end

  defp broadcast(event, payload) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "intelligence:vm", {event, payload})
  end
end
