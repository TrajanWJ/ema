defmodule Ema.Intelligence.VmMonitor do
  @moduledoc """
  GenServer that polls agent-vm (192.168.122.10) every 30s.
  Checks VM reachability, OpenClaw gateway health, SSH, and Docker containers.
  """

  use GenServer
  require Logger

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Intelligence.VmHealthEvent

  @vm_ip "192.168.122.10"
  @openclaw_url "http://192.168.122.10:18789/gateway"
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

    ping_ok = check_ping()
    ssh_ok = check_ssh()
    {openclaw_ok, openclaw_latency} = check_openclaw()
    containers_json = fetch_containers()

    total_latency = System.monotonic_time(:millisecond) - start

    status =
      cond do
        ping_ok and openclaw_ok -> "online"
        ping_ok -> "degraded"
        true -> "offline"
      end

    attrs = %{
      id: Ecto.UUID.generate(),
      status: status,
      openclaw_up: openclaw_ok,
      ssh_up: ssh_ok,
      containers_json: containers_json,
      latency_ms: openclaw_latency || round(total_latency),
      checked_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }

    case %VmHealthEvent{} |> VmHealthEvent.changeset(attrs) |> Repo.insert() do
      {:ok, event} ->
        if status != state.last_status do
          broadcast(:vm_status_changed, %{status: status, previous: state.last_status})
        end

        broadcast(:vm_health_checked, %{
          status: status,
          openclaw_up: openclaw_ok,
          ssh_up: ssh_ok,
          latency_ms: event.latency_ms
        })

      {:error, reason} ->
        Logger.warning("VmMonitor: failed to store health event: #{inspect(reason)}")
    end

    %{state | last_status: status}
  end

  defp check_ping do
    case System.cmd("ping", ["-c", "1", "-W", "2", @vm_ip], stderr_to_stdout: true) do
      {_, 0} -> true
      _ -> false
    end
  rescue
    _ -> false
  end

  defp check_ssh do
    case System.cmd("nc", ["-z", "-w", "2", @vm_ip, "22"], stderr_to_stdout: true) do
      {_, 0} -> true
      _ -> false
    end
  rescue
    _ -> false
  end

  defp check_openclaw do
    start = System.monotonic_time(:millisecond)

    result =
      case System.cmd("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--connect-timeout", "3", "--max-time", "5", @openclaw_url], stderr_to_stdout: true) do
        {code, 0} ->
          String.trim(code) |> String.starts_with?("2")

        _ ->
          false
      end

    latency = System.monotonic_time(:millisecond) - start
    {result, round(latency)}
  rescue
    _ -> {false, nil}
  end

  defp fetch_containers do
    case System.cmd("ssh", ["-o", "ConnectTimeout=3", "-o", "StrictHostKeyChecking=no", "trajan@#{@vm_ip}", "docker ps --format '{{json .}}'"], stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.map(fn line ->
          case Jason.decode(line) do
            {:ok, parsed} -> parsed
            _ -> nil
          end
        end)
        |> Enum.reject(&is_nil/1)
        |> Jason.encode!()

      _ ->
        "[]"
    end
  rescue
    _ -> "[]"
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
