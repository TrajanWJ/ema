defmodule Ema.Harvesters.Base do
  @moduledoc "Shared harvester GenServer behaviour and helpers."

  @callback harvester_name() :: String.t()
  @callback default_interval() :: non_neg_integer()
  @callback harvest(map()) :: {:ok, map()} | {:error, term()}

  defmacro __using__(opts) do
    quote do
      use GenServer
      require Logger
      @behaviour Ema.Harvesters.Base

      @harvester_name unquote(opts[:name])
      @default_interval unquote(opts[:interval] || :timer.hours(1))

      def start_link(opts \\ []) do
        GenServer.start_link(__MODULE__, opts, name: __MODULE__)
      end

      def run_now, do: GenServer.cast(__MODULE__, :run_now)
      def pause, do: GenServer.call(__MODULE__, :pause)
      def resume, do: GenServer.call(__MODULE__, :resume)

      def status do
        GenServer.call(__MODULE__, :status)
      catch
        :exit, _ -> %{name: @harvester_name, status: "stopped", error: "not_running"}
      end

      @impl GenServer
      def init(opts) do
        interval = Keyword.get(opts, :interval, @default_interval)
        paused = Keyword.get(opts, :paused, false)
        unless paused, do: schedule_tick(interval)

        {:ok, %{
          paused: paused,
          interval: interval,
          running: false,
          last_run_at: nil,
          last_result: nil,
          run_count: 0
        }}
      end

      @impl GenServer
      def handle_call(:pause, _from, state) do
        Logger.info("[#{@harvester_name}] paused")
        {:reply, :ok, %{state | paused: true}}
      end

      @impl GenServer
      def handle_call(:resume, _from, state) do
        unless state.paused == false, do: schedule_tick(state.interval)
        Logger.info("[#{@harvester_name}] resumed")
        {:reply, :ok, %{state | paused: false}}
      end

      @impl GenServer
      def handle_call(:status, _from, state) do
        status = %{
          name: @harvester_name,
          paused: state.paused,
          running: state.running,
          last_run_at: state.last_run_at,
          last_result: state.last_result,
          run_count: state.run_count,
          interval_ms: state.interval
        }
        {:reply, status, state}
      end

      @impl GenServer
      def handle_cast(:run_now, state) do
        if state.running do
          Logger.info("[#{@harvester_name}] already running, skipping")
          {:noreply, state}
        else
          do_harvest(state)
        end
      end

      @impl GenServer
      def handle_info(:tick, %{paused: true} = state) do
        schedule_tick(state.interval)
        {:noreply, state}
      end

      @impl GenServer
      def handle_info(:tick, %{running: true} = state) do
        schedule_tick(state.interval)
        {:noreply, state}
      end

      @impl GenServer
      def handle_info(:tick, state) do
        {_, state} = do_harvest(state)
        schedule_tick(state.interval)
        {:noreply, state}
      end

      @impl GenServer
      def handle_info({:harvest_complete, result}, state) do
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        state = %{state |
          running: false,
          last_run_at: now,
          last_result: result,
          run_count: state.run_count + 1
        }

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "harvesters:events",
          {:harvest_complete, @harvester_name, result}
        )

        {:noreply, state}
      end

      defp do_harvest(state) do
        me = self()

        Task.Supervisor.start_child(Ema.Harvesters.TaskSupervisor, fn ->
          {:ok, run} = Ema.Harvesters.start_run(@harvester_name)

          result =
            try do
              case harvest(%{}) do
                {:ok, stats} ->
                  Ema.Harvesters.complete_run(run, %{
                    status: "success",
                    items_found: stats[:items_found] || 0,
                    seeds_created: stats[:seeds_created] || 0,
                    entities_created: stats[:entities_created] || 0,
                    metadata: stats[:metadata] || %{}
                  })
                  %{status: "success", items_found: stats[:items_found] || 0, seeds_created: stats[:seeds_created] || 0}

                {:error, reason} ->
                  Ema.Harvesters.complete_run(run, %{
                    status: "failed",
                    error: inspect(reason)
                  })
                  %{status: "failed", error: inspect(reason)}
              end
            rescue
              e ->
                Ema.Harvesters.complete_run(run, %{
                  status: "failed",
                  error: Exception.message(e)
                })
                %{status: "failed", error: Exception.message(e)}
            end

          send(me, {:harvest_complete, result})
        end)

        {:noreply, %{state | running: true}}
      end

      defp schedule_tick(interval) do
        Process.send_after(self(), :tick, interval)
      end

      defoverridable init: 1
    end
  end
end
