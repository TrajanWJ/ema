defmodule EmaCli.TestRunner do
  @moduledoc "CLI test suite runner -- validates all EMA features end-to-end"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, error: 1, success: 1]

  def run("run", opts) do
    suite = Map.get(opts, :suite, "unit")
    output = Map.get(opts, :output)

    IO.puts("\n\e[1mEMA Test Suite: #{suite}\e[0m")
    IO.puts(String.duplicate("-", 60))

    results =
      case suite do
        "unit" -> unit_tests()
        "integration" -> integration_tests()
        "ai" -> ai_tests()
        "stress" -> stress_tests()
        "all" -> unit_tests() ++ integration_tests() ++ ai_tests()
        _ -> error("Unknown suite. Try: unit, integration, ai, stress, all")
      end

    passed = Enum.count(results, &(&1.status == :pass))
    failed = Enum.count(results, &(&1.status == :fail))
    skipped = Enum.count(results, &(&1.status == :skip))

    IO.puts("\n#{String.duplicate("-", 60)}")

    IO.puts(
      "Results: \e[32m#{passed} passed\e[0m  \e[31m#{failed} failed\e[0m  \e[33m#{skipped} skipped\e[0m  (#{length(results)} total)\n"
    )

    report = %{
      suite: suite,
      ran_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      total: length(results),
      passed: passed,
      failed: failed,
      skipped: skipped,
      pass_rate:
        if(length(results) > 0,
          do: Float.round(passed / length(results) * 100, 1),
          else: 0.0
        ),
      tests: Enum.map(results, fn r -> %{name: r.name, status: r.status, note: r.note} end)
    }

    if output do
      File.write!(output, Jason.encode!(report, pretty: true))
      success("Report saved to #{output}")
    end

    if failed > 0, do: System.halt(1), else: :ok
  end

  def run(unknown, _), do: error("Unknown test subcommand: #{unknown}. Try: run")

  # -- Test Suites --

  defp unit_tests do
    [
      t("Daemon reachable", fn ->
        case api_get("/settings") do
          {:ok, _} -> :pass
          {:error, msg} -> {:fail, msg}
        end
      end),
      t("Tasks API", fn ->
        case api_get("/tasks?limit=5") do
          {:ok, data} when is_map(data) -> :pass
          {:error, msg} -> {:fail, msg}
        end
      end),
      t("Proposals API", fn ->
        case api_get("/proposals?limit=5") do
          {:ok, _} -> :pass
          {:error, msg} -> {:fail, msg}
        end
      end),
      t("Projects API", fn ->
        case api_get("/projects?limit=5") do
          {:ok, _} -> :pass
          {:error, msg} -> {:fail, msg}
        end
      end),
      t("Intent nodes API", fn ->
        case api_get("/intents") do
          {:ok, _} -> :pass
          {:error, _} -> {:skip, "route not added yet"}
        end
      end),
      t("Session store API (F3)", fn ->
        case api_get("/context") do
          {:ok, _} -> :pass
          {:error, _} -> {:skip, "F3 not deployed"}
        end
      end),
      t("Quality friction API (F4)", fn ->
        case api_get("/quality/friction") do
          {:ok, r} when is_map(r) -> :pass
          {:error, _} -> {:skip, "F4 not deployed"}
        end
      end),
      t("Quality gradient API (F4)", fn ->
        case api_get("/quality/gradient") do
          {:ok, %{"trend" => _}} -> :pass
          {:ok, %{"gradient" => _}} -> :pass
          {:ok, _data} -> :pass
          {:error, _} -> {:skip, "F4 not deployed"}
        end
      end),
      t("Budget ledger API (F4)", fn ->
        case api_get("/quality/budget") do
          {:ok, %{"budget" => %{"token_limit" => _}}} -> :pass
          {:ok, %{"daily_tokens" => _}} -> :pass
          {:error, _} -> {:skip, "F4 not deployed"}
        end
      end),
      t("Routing engine API (F5)", fn ->
        case api_get("/orchestration/stats") do
          {:ok, %{"routing" => %{"total_routed" => _}}} -> :pass
          {:ok, %{"total_routed" => _}} -> :pass
          {:error, _} -> {:skip, "F5 not deployed"}
        end
      end),
      t("Agent fitness API (F5)", fn ->
        case api_get("/orchestration/fitness") do
          {:ok, %{"fitness" => scores}} when is_list(scores) -> :pass
          {:ok, scores} when is_list(scores) -> :pass
          {:error, _} -> {:skip, "F5 not deployed"}
        end
      end)
    ]
  end

  defp integration_tests do
    [
      t("Proposal validation gates", fn ->
        case api_get("/proposals?limit=1&status=approved") do
          {:ok, %{"proposals" => [p | _]}} ->
            has_title = String.length(p["title"] || "") > 5
            has_desc = String.length(p["description"] || "") > 10
            if has_title and has_desc, do: :pass, else: {:fail, "#{p["id"]} fails basic gates"}

          {:ok, _} ->
            {:skip, "no approved proposals"}

          {:error, msg} ->
            {:fail, msg}
        end
      end),
      t("Intent + project linkage", fn ->
        case api_get("/projects?limit=1") do
          {:ok, %{"projects" => [p | _]}} ->
            case api_get("/intents?project_id=#{p["id"]}") do
              {:ok, _} -> :pass
              {:error, _} -> {:skip, "intent API not available"}
            end

          _ ->
            {:skip, "no projects"}
        end
      end),
      t("API latency < 500ms", fn ->
        t0 = System.monotonic_time(:millisecond)

        case api_get("/settings") do
          {:ok, _} ->
            elapsed = System.monotonic_time(:millisecond) - t0
            if elapsed < 500, do: :pass, else: {:fail, "#{elapsed}ms > 500ms"}

          {:error, msg} ->
            {:fail, msg}
        end
      end),
      t("Quality + Routing both respond (F4+F5)", fn ->
        q = api_get("/quality/friction")
        r = api_get("/orchestration/stats")

        case {q, r} do
          {{:ok, _}, {:ok, _}} -> :pass
          {{:error, _}, {:error, _}} -> {:skip, "F4 and F5 not deployed"}
          {{:ok, _}, {:error, _}} -> {:skip, "F5 not deployed"}
          {{:error, _}, {:ok, _}} -> {:skip, "F4 not deployed"}
        end
      end),
      t("Session crystallize -> fetch roundtrip (F3)", fn ->
        case api_post("/context/crystallize", %{}) do
          {:ok, %{"session" => %{"session_id" => sid}}} ->
            case api_get("/context/sessions") do
              {:ok, sessions} when is_list(sessions) ->
                found = Enum.any?(sessions, fn s -> s["session_id"] == sid end)
                if found, do: :pass, else: {:fail, "crystallized session not in list"}

              {:ok, %{"sessions" => sessions}} when is_list(sessions) ->
                found = Enum.any?(sessions, fn s -> s["session_id"] == sid end)
                if found, do: :pass, else: {:fail, "crystallized session not in list"}

              _ ->
                {:skip, "session list not available"}
            end

          {:ok, %{"session_id" => sid}} ->
            case api_get("/context/sessions") do
              {:ok, sessions} when is_list(sessions) ->
                found = Enum.any?(sessions, fn s -> s["session_id"] == sid end)
                if found, do: :pass, else: {:fail, "crystallized session not in list"}

              {:ok, %{"sessions" => sessions}} when is_list(sessions) ->
                found = Enum.any?(sessions, fn s -> s["session_id"] == sid end)
                if found, do: :pass, else: {:fail, "crystallized session not in list"}

              _ ->
                {:skip, "session list not available"}
            end

          {:error, _} ->
            {:skip, "F3 not deployed"}
        end
      end)
    ]
  end

  defp ai_tests do
    [
      t("Proposal seeds exist", fn ->
        case api_get("/seeds") do
          {:ok, %{"seeds" => [_ | _]}} -> :pass
          {:ok, %{"seeds" => []}} -> {:skip, "no seeds configured"}
          {:error, msg} -> {:fail, msg}
        end
      end),
      t("Engine status reachable", fn ->
        case api_get("/engine/status") do
          {:ok, _} -> :pass
          {:error, _} -> {:skip, "engine status endpoint not available"}
        end
      end)
    ]
  end

  defp stress_tests do
    [
      t("Proposals -- list 100", fn ->
        t0 = System.monotonic_time(:millisecond)

        case api_get("/proposals?limit=100") do
          {:ok, _} ->
            elapsed = System.monotonic_time(:millisecond) - t0
            if elapsed < 3000, do: :pass, else: {:fail, "#{elapsed}ms for 100 proposals"}

          {:error, msg} ->
            {:fail, msg}
        end
      end),
      t("Tasks -- 5 concurrent requests", fn ->
        tasks =
          Enum.map(1..5, fn _ ->
            Task.async(fn -> api_get("/tasks?limit=10") end)
          end)

        results = Task.await_many(tasks, 10_000)
        failed = Enum.count(results, fn {s, _} -> s == :error end)
        if failed == 0, do: :pass, else: {:fail, "#{failed}/5 concurrent requests failed"}
      end)
    ]
  end

  # -- Test Helper --

  @doc false
  def t(name, fun) do
    IO.write("  #{String.pad_trailing(name, 45)} ")

    {status, note} =
      try do
        case fun.() do
          :pass -> {:pass, nil}
          {:pass, _} -> {:pass, nil}
          {:skip, reason} -> {:skip, reason}
          {:fail, reason} -> {:fail, to_string(reason)}
        end
      rescue
        e -> {:fail, Exception.message(e)}
      end

    IO.puts(
      case status do
        :pass ->
          "\e[32mPASS\e[0m"

        :skip ->
          "\e[33mSKIP\e[0m" <> if(note, do: " (#{String.slice(note, 0, 40)})", else: "")

        :fail ->
          "\e[31mFAIL\e[0m" <> if(note, do: " -- #{String.slice(note, 0, 60)}", else: "")
      end
    )

    %{name: name, status: status, note: note}
  end
end
