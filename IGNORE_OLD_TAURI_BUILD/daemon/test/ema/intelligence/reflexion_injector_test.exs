defmodule Ema.Intelligence.ReflexionInjectorTest do
  use Ema.DataCase, async: false

  alias Ema.Intelligence.{ReflexionInjector, ReflexionStore}

  test "build_prefix/3 includes the last three matching lessons in chronological order" do
    assert {:ok, _} = ReflexionStore.record("claude", "backend", "ema", "Older lesson", "success")
    assert {:ok, _} = ReflexionStore.record("claude", "backend", "ema", "Second lesson", "failed")
    assert {:ok, _} = ReflexionStore.record("claude", "backend", "ema", "Third lesson", "success")

    assert {:ok, _} =
             ReflexionStore.record("claude", "backend", "ema", "Newest lesson", "success")

    assert {:ok, _} =
             ReflexionStore.record("claude", "frontend", "ema", "Wrong domain", "success")

    prefix = ReflexionInjector.build_prefix("claude", "backend", "ema")

    assert prefix =~ "Past lessons:"
    refute prefix =~ "Older lesson"
    assert prefix =~ "[failed] Second lesson"
    assert prefix =~ "[success] Third lesson"
    assert prefix =~ "[success] Newest lesson"
  end

  test "build_prefix/3 returns an empty string when no lessons exist" do
    assert ReflexionInjector.build_prefix("none", "backend", "ema") == ""
  end
end
