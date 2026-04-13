defmodule Ema.ProposalEngine.SchedulerTest do
  use Ema.DataCase, async: false

  alias Ema.ProposalEngine.Scheduler

  setup do
    # Start a scheduler instance for testing (paused so no ticks fire).
    # Use a unique name to avoid conflicts, but the module uses __MODULE__ as name,
    # so we must ensure only one runs at a time (async: false).
    {:ok, pid} = Scheduler.start_link(paused: true)

    on_exit(fn ->
      if Process.alive?(pid) do
        GenServer.stop(pid, :normal, 1000)
      end
    end)

    %{pid: pid}
  end

  describe "status/0" do
    test "returns scheduler status" do
      status = Scheduler.status()
      assert status.paused == true
      assert status.seeds_dispatched == 0
      assert status.last_tick_at == nil
    end
  end

  describe "pause/0 and resume/0" do
    test "pauses and resumes" do
      assert :ok = Scheduler.pause()
      assert %{paused: true} = Scheduler.status()

      assert :ok = Scheduler.resume()
      assert %{paused: false} = Scheduler.status()
    end
  end

  describe "run_seed/1" do
    test "dispatches a seed by id" do
      {:ok, seed} =
        Ema.Proposals.create_seed(%{
          name: "Test Runner Seed",
          prompt_template: "Generate something",
          seed_type: "cron"
        })

      # run_seed is a cast that internally calls Generator (not running) and
      # increment_seed_run_count. Generator.generate is a cast to a named process
      # that doesn't exist — it's silently dropped. That's expected in tests.
      Scheduler.run_seed(seed.id)

      # Give cast time to process
      Process.sleep(100)

      updated_seed = Ema.Proposals.get_seed(seed.id)
      assert updated_seed.run_count == 1
      assert updated_seed.last_run_at != nil
    end

    test "handles nonexistent seed gracefully" do
      Scheduler.run_seed("nonexistent_seed_id")
      Process.sleep(100)
      # Scheduler should still be alive and working
      assert %{paused: true} = Scheduler.status()
    end
  end
end
