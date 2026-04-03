defmodule Ema.Agents.NetworkMonitor do
  @moduledoc """
  Periodically checks OpenClaw agent network status via SSH
  and broadcasts updates over PubSub.
  """

  use GenServer
  require Logger

  @check_interval :timer.seconds(30)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def get_status do
    GenServer.call(__MODULE__, :get_status)
  catch
    :exit, _ -> %{agents: [], gateway_reachable: false, last_check: nil}
  end

  @impl true
  def init(_opts) do
    schedule_check(1_000)
    {:ok, %{status: %{agents: [], gateway_reachable: false, last_check: nil}, checking: false}}
  end

  @impl true
  def handle_call(:get_status, _from, state) do
    {:reply, state.status, state}
  end

  @impl true
  def handle_info(:check, %{checking: true} = state) do
    schedule_check()
    {:noreply, state}
  end

  def handle_info(:check, state) do
    parent = self()

    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      result = do_check()
      send(parent, {:check_result, result})
    end)

    {:noreply, %{state | checking: true}}
  end

  def handle_info({:check_result, status}, state) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "agent_network", {:network_status, status})
    schedule_check()
    {:noreply, %{state | status: status, checking: false}}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_check(delay \\ @check_interval) do
    Process.send_after(self(), :check, delay)
  end

  defp do_check do
    host = ssh_host()

    try do
      case System.cmd(
             "ssh",
             [
               "-o",
               "ConnectTimeout=5",
               "-o",
               "StrictHostKeyChecking=no",
               host,
               "openclaw sessions list 2>/dev/null || echo '[]'"
             ],
             stderr_to_stdout: true,
             timeout: 10_000
           ) do
        {output, 0} ->
          agents = parse_agents(output)
          %{agents: agents, gateway_reachable: true, last_check: DateTime.utc_now()}

        {_output, _code} ->
          %{agents: [], gateway_reachable: false, last_check: DateTime.utc_now()}
      end
    rescue
      _ -> %{agents: [], gateway_reachable: false, last_check: DateTime.utc_now()}
    catch
      :exit, _ -> %{agents: [], gateway_reachable: false, last_check: DateTime.utc_now()}
    end
  end

  defp ssh_host do
    Application.get_env(:ema, :openclaw, [])[:ssh_host] || "trajan@192.168.122.10"
  end

  defp parse_agents(output) do
    case Jason.decode(String.trim(output)) do
      {:ok, agents} when is_list(agents) -> agents
      _ -> []
    end
  end
end
