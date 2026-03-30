defmodule Ema.Canvas.DataRefresherTest do
  use Ema.DataCase, async: false
  alias Ema.Canvas.DataRefresher

  describe "track_element/4 and untrack_element/1" do
    test "tracks an element" do
      DataRefresher.track_element("elm_1", "tasks:by_status", %{}, 30)

      tracked = DataRefresher.tracked_elements()
      assert Map.has_key?(tracked, "elm_1")
      assert tracked["elm_1"].data_source == "tasks:by_status"
      assert tracked["elm_1"].refresh_interval == 30

      # Cleanup
      DataRefresher.untrack_element("elm_1")
    end

    test "untracks an element" do
      DataRefresher.track_element("elm_2", "tasks:by_status", %{}, 60)
      DataRefresher.untrack_element("elm_2")

      # Give the cast time to process
      Process.sleep(50)

      tracked = DataRefresher.tracked_elements()
      refute Map.has_key?(tracked, "elm_2")
    end
  end

  describe "refresh cycle" do
    test "tick message is handled without crash" do
      # The GenServer should handle :tick without errors
      send(DataRefresher, :tick)
      # If we can still call it, it survived
      Process.sleep(50)
      assert is_map(DataRefresher.tracked_elements())
    end

    test "broadcasts data on refresh" do
      Phoenix.PubSub.subscribe(Ema.PubSub, "canvas:data:elm_test")

      # Track with refresh_interval of 0 so it fires immediately
      DataRefresher.track_element("elm_test", "tasks:by_status", %{}, 0)

      # Ensure the cast is processed before triggering tick
      _ = DataRefresher.tracked_elements()

      # Trigger a tick
      send(DataRefresher, :tick)

      assert_receive {:data_refresh, "elm_test", data}, 2000
      assert is_list(data)

      # Cleanup
      DataRefresher.untrack_element("elm_test")
      Phoenix.PubSub.unsubscribe(Ema.PubSub, "canvas:data:elm_test")
    end
  end
end
