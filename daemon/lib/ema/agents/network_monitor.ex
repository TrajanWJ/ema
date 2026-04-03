defmodule Ema.Agents.NetworkMonitor do
  @moduledoc """
  Periodically checks local agent network status by querying
  Ema.Agents.Supervisor for running workers, and broadcasts
  updates over PubSub.
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
    try do
      # Query the local DynamicSupervisor for running agent workers
      children = DynamicSupervisor.which_children(Ema.Agents.Supervisor)

      agents =
        children
        |> Enum.map(fn {_id, pid, _type, _modules} ->
          if is_pid(pid) and Process.alive?(pid) do
            %{"pid" => inspect(pid), "status" => "running"}
          else
            nil
          end
        end)
        |> Enum.reject(&is_nil/1)

      gateway_reachable = length(agents) >= 0 and is_pid(Process.whereis(Ema.Agents.Supervisor))

      %{agents: agents, gateway_reachable: gateway_reachable, last_check: DateTime.utc_now()}
    rescue
      _ -> %{agents: [], gateway_reachable: false, last_check: DateTime.utc_now()}
    catch
      :exit, _ -> %{agents: [], gateway_reachable: false, last_check: DateTime.utc_now()}
    end
  end
end
