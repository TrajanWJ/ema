defmodule Ema.Intelligence.ScopeAdvisorTest do
  use ExUnit.Case, async: false

  alias Ema.Intelligence.ScopeAdvisor

  setup do
    tmp_path =
      Path.join(System.tmp_dir!(), "ema-scope-advisor-#{System.unique_integer([:positive])}.json")

    original = Application.get_env(:ema, :ema_tracker_path)
    Application.put_env(:ema, :ema_tracker_path, tmp_path)
    File.rm(tmp_path)

    start_supervised!(Ema.Intelligence.OutcomeTracker)

    on_exit(fn ->
      File.rm(tmp_path)

      case original do
        nil -> Application.delete_env(:ema, :ema_tracker_path)
        path -> Application.put_env(:ema, :ema_tracker_path, path)
      end
    end)

    :ok
  end

  test "warns when 2 of the last 5 outcomes failed or timed out" do
    write_tracker([
      %{"agent" => "coder", "domain" => "backend", "status" => "failed"},
      %{"agent" => "coder", "domain" => "backend", "status" => "ok"},
      %{"agent" => "coder", "domain" => "backend", "status" => "timeout"},
      %{"agent" => "coder", "domain" => "backend", "status" => "ok"},
      %{"agent" => "coder", "domain" => "backend", "status" => "ok"}
    ])

    assert {:warn, reason} = ScopeAdvisor.check("coder", "backend", "Tighten task")
    assert reason =~ "coder/backend"
  end

  test "returns ok below threshold" do
    write_tracker([
      %{"agent" => "coder", "domain" => "backend", "status" => "failed"},
      %{"agent" => "coder", "domain" => "backend", "status" => "ok"},
      %{"agent" => "coder", "domain" => "backend", "status" => "ok"}
    ])

    assert :ok = ScopeAdvisor.check("coder", "backend", "Small task")
  end

  defp write_tracker(entries) do
    path = Application.fetch_env!(:ema, :ema_tracker_path)
    File.write!(path, Jason.encode!(entries))
  end
end
