defmodule EmaCli.Proposal do
  @moduledoc "CLI commands for Proposals"

  import EmaCli.CLI,
    only: [api_get: 1, api_post: 2, format_output: 2, error: 1, warn: 1, success: 1]

  def run("list", opts) do
    params = build_query(opts)

    case api_get("/proposals#{params}") do
      {:ok, %{"proposals" => proposals}} -> format_output(proposals, opts)
      {:ok, proposals} when is_list(proposals) -> format_output(proposals, opts)
      {:error, msg} -> error(msg)
    end
  end

  def run("show", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema proposal show <id>")

    case api_get("/proposals/#{id}") do
      {:ok, p} when is_map(p) -> format_output([p], opts)
      {:error, msg} -> error(msg)
    end
  end

  def run("validate", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema proposal validate <id>")

    case api_get("/proposals/#{id}") do
      {:ok, proposal} ->
        gates = run_gates(proposal)
        IO.puts("\n\e[1mValidation -- #{proposal["title"] || id}\e[0m")
        IO.puts(String.duplicate("-", 50))

        Enum.each(gates, fn {name, result, note} ->
          icon = if result == :pass, do: "\e[32m+\e[0m", else: "\e[31mx\e[0m"
          IO.puts("  #{icon} #{String.pad_trailing(name, 20)} #{note}")
        end)

        passed = Enum.count(gates, fn {_, r, _} -> r == :pass end)
        pct = Float.round(passed / length(gates) * 100, 1)

        color =
          cond do
            pct >= 80 -> "\e[32m"
            pct >= 50 -> "\e[33m"
            true -> "\e[31m"
          end

        IO.puts("\n  Score: #{color}#{pct}%\e[0m (#{passed}/#{length(gates)} gates)")

      {:error, msg} ->
        error(msg)
    end
  end

  def run("approve", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema proposal approve <id>")

    case api_post("/proposals/#{id}/approve", %{}) do
      {:ok, _} -> success("Proposal #{id} approved")
      {:error, msg} -> error(msg)
    end
  end

  def run("reject", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema proposal reject <id>")

    case api_post("/proposals/#{id}/kill", %{}) do
      {:ok, _} -> success("Proposal #{id} rejected (killed)")
      {:error, msg} -> error(msg)
    end
  end

  def run("generate", opts) do
    seed =
      Map.get(opts, :seed) || Map.get(opts, :_arg) ||
        error("Usage: ema proposal generate --seed=\"...\"")

    project_id = Map.get(opts, :project)
    count = String.to_integer(to_string(Map.get(opts, :count, "1")))
    measure = Map.get(opts, :"measure-latency", false)

    IO.puts("Generating #{count} seed(s): \"#{String.slice(seed, 0, 60)}\"")

    results =
      Enum.map(1..count, fn i ->
        t0 = System.monotonic_time(:millisecond)
        attrs = %{prompt: seed, project_id: project_id, frequency: "manual", tags: "[]"}
        result = api_post("/seeds", attrs)
        elapsed = System.monotonic_time(:millisecond) - t0

        status_str =
          case result do
            {:ok, s} ->
              if measure do
                IO.puts("  [#{i}] Created #{s["id"]} in #{elapsed}ms")
              else
                IO.puts("  [#{i}] Created #{s["id"]}")
              end

              :ok

            {:error, msg} ->
              IO.puts("  [#{i}] \e[31mFailed: #{msg}\e[0m")
              :error
          end

        {status_str, elapsed}
      end)

    ok = Enum.count(results, fn {s, _} -> s == :ok end)

    if measure do
      avg = Enum.sum(Enum.map(results, fn {_, t} -> t end)) / length(results)
      IO.puts("\n#{ok}/#{count} succeeded. Avg latency: #{round(avg)}ms")
    else
      IO.puts("\n#{ok}/#{count} seeds created")
    end
  end

  def run("genealogy", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema proposal genealogy <id>")

    case api_get("/proposals/#{id}/lineage") do
      {:ok, %{"lineage" => lineage}} when is_list(lineage) ->
        IO.puts("\n\e[1mGenealogy for #{id}\e[0m")

        Enum.with_index(lineage, fn p, i ->
          indent = String.duplicate("  ", i)
          gen = p["generation"] || i
          IO.puts("#{indent}-- \e[2m[gen #{gen}]\e[0m #{p["title"]} \e[2m(#{p["status"]})\e[0m")
        end)

      {:ok, data} ->
        format_output([data], opts)

      {:error, _} ->
        warn("Genealogy endpoint not available -- genealogy is part of F2 feature")
    end
  end

  def run(unknown, _),
    do:
      error(
        "Unknown proposal subcommand: #{unknown}. Try: list, show, validate, approve, reject, generate, genealogy"
      )

  defp build_query(opts) do
    params = []
    params = if Map.get(opts, :status), do: ["status=#{opts.status}" | params], else: params
    params = if Map.get(opts, :project), do: ["project_id=#{opts.project}" | params], else: params
    limit = Map.get(opts, :limit, "20")
    params = ["limit=#{limit}" | params]
    "?" <> Enum.join(params, "&")
  end

  defp run_gates(p) do
    title_len = String.length(p["title"] || "")
    desc_len = String.length(p["description"] || "")
    score = p["score"] || 0

    [
      {"has_title", if(title_len > 5, do: :pass, else: :fail), "len=#{title_len}"},
      {"has_description", if(desc_len > 20, do: :pass, else: :fail), "len=#{desc_len}"},
      {"has_score", if(not is_nil(p["score"]), do: :pass, else: :fail), "score=#{p["score"]}"},
      {"score_threshold", if(score >= 0.5, do: :pass, else: :fail), "#{score} >= 0.5"},
      {"has_status", if(not is_nil(p["status"]), do: :pass, else: :fail), "status=#{p["status"]}"}
    ]
  end
end
