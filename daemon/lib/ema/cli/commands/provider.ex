defmodule Ema.CLI.Commands.Provider do
  @moduledoc "CLI commands for AI provider management."

  alias Ema.CLI.Output

  def handle([:list], _parsed, transport, opts) do
    case transport.get("/providers") do
      {:ok, body} ->
        if opts[:json] do
          Output.json(body)
        else
          providers = body["providers"] || []

          rows =
            Enum.map(providers, fn p ->
              status_icon =
                case p["status"] do
                  "available" -> "🟢"
                  "degraded" -> "🟡"
                  "offline" -> "🔴"
                  "rate_limited" -> "🟠"
                  _ -> "⚪"
                end

              %{
                "id" => p["id"],
                "type" => p["type"],
                "name" => p["name"],
                "status" => "#{status_icon} #{p["status"]}",
                "models" => inspect((p["capabilities"] || %{})["models"] || [])
              }
            end)

          Output.table(
            rows,
            [
              {"ID", "id"},
              {"Type", "type"},
              {"Name", "name"},
              {"Status", "status"},
              {"Models", "models"}
            ],
            []
          )
        end

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:status], _parsed, transport, opts) do
    case transport.get("/providers") do
      {:ok, body} ->
        if opts[:json] do
          Output.json(body)
        else
          providers = body["providers"] || []
          exec = body["execution_status"] || %{}

          Output.info(
            "Execution: #{exec["status"] || "unknown"} (provider: #{exec["selected_provider"] || "none"})"
          )

          IO.puts("")

          Enum.each(providers, fn p ->
            health = p["health"] || %{}
            rate = p["rate_limits"] || %{}

            Output.info("── #{p["name"]} (#{p["id"]}) ──")
            Output.info("  Type:       #{p["type"]}")
            Output.info("  Status:     #{p["status"]}")
            Output.info("  Accounts:   #{p["accounts"] || 0}")
            Output.info("  Latency:    #{health["latency_ms"] || "-"}ms")
            Output.info("  Error rate: #{health["error_rate"] || 0}")

            Output.info(
              "  RPM:        #{rate["current_rpm"] || 0}/#{rate["requests_per_min"] || "∞"}"
            )

            IO.puts("")
          end)
        end

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:health], _parsed, transport, opts) do
    case transport.get("/providers") do
      {:ok, body} ->
        providers = body["providers"] || []

        results =
          Enum.map(providers, fn p ->
            case transport.post("/providers/#{p["id"]}/health", %{}) do
              {:ok, result} ->
                Map.put(result, "name", p["name"])

              {:error, _} ->
                %{
                  "provider_id" => p["id"],
                  "name" => p["name"],
                  "health" => %{"status" => "unreachable"}
                }
            end
          end)

        if opts[:json] do
          Output.json(%{"results" => results})
        else
          Enum.each(results, fn r ->
            h = r["health"] || %{}
            status = h["status"] || "unknown"

            icon =
              case status do
                "healthy" -> "🟢"
                "unhealthy" -> "🔴"
                _ -> "⚪"
              end

            latency = if h["latency_ms"], do: " (#{h["latency_ms"]}ms)", else: ""
            Output.info("#{icon} #{r["name"] || r["provider_id"]}: #{status}#{latency}")
          end)
        end

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:health, provider_id], _parsed, transport, opts) do
    case transport.post("/providers/#{provider_id}/health", %{}) do
      {:ok, result} ->
        if opts[:json], do: Output.json(result), else: Output.detail(result)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:detect], _parsed, transport, opts) do
    case transport.post("/providers/detect", %{}) do
      {:ok, body} ->
        if opts[:json] do
          Output.json(body)
        else
          detected = body["detected"] || %{}

          Output.success(
            "Detection complete: #{detected["providers"] || 0} providers, #{detected["accounts"] || 0} accounts"
          )
        end

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown provider subcommand: #{inspect(sub)}")
  end
end
