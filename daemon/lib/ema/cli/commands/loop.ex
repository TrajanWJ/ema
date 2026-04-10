defmodule Ema.CLI.Commands.Loop do
  @moduledoc "CLI commands for loop tracking — outbound actions awaiting response."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Type", :loop_type},
    {"Target", :target},
    {"Age", :age_days},
    {"Lvl", :escalation_label},
    {"Touches", :touch_count},
    {"Status", :status}
  ]

  def handle([:list], parsed, transport, opts) do
    status = parsed.options[:status]
    escalated = parsed.flags[:escalated]
    min_level = if escalated, do: 1, else: parsed.options[:min_level]

    case transport do
      Ema.CLI.Transport.Direct ->
        filter =
          Helpers.compact_keyword([
            {:status, status},
            {:min_level, min_level}
          ])

        case transport.call(Ema.Loops, :list_loops, [filter]) do
          {:ok, loops} ->
            Output.render(Enum.map(loops, &serialize/1), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params =
          Helpers.compact_keyword([
            {:status, status},
            {:min_level, min_level}
          ])

        case transport.get("/loops", params: params) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "loops"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:open], parsed, transport, opts) do
    attrs = %{
      "loop_type" => parsed.options[:type],
      "target" => parsed.options[:target],
      "context" => parsed.options[:context],
      "channel" => parsed.options[:channel],
      "follow_up_text" => parsed.options[:follow_up],
      "project_id" => parsed.options[:project]
    }

    cond do
      is_nil(attrs["loop_type"]) ->
        Output.error("--type is required (e.g. email_sent, dm_sent)")

      is_nil(attrs["target"]) ->
        Output.error("--target is required")

      true ->
        case transport do
          Ema.CLI.Transport.Direct ->
            case transport.call(Ema.Loops, :open_loop, [attrs]) do
              {:ok, loop} ->
                Output.success("Loop opened: #{loop.id} (#{loop.loop_type}) -> #{loop.target}")
                if opts[:json], do: Output.json(serialize(loop))

              {:error, reason} ->
                Output.error(inspect(reason))
            end

          Ema.CLI.Transport.Http ->
            case transport.post("/loops", Helpers.compact_map(Map.to_list(attrs))) do
              {:ok, body} ->
                loop = Helpers.extract_record(body, "loop")
                Output.success("Loop opened: #{loop["id"]} -> #{loop["target"]}")
                if opts[:json], do: Output.json(loop)

              {:error, reason} ->
                Output.error(inspect(reason))
            end
        end
    end
  end

  def handle([:close], parsed, transport, opts) do
    id = parsed.args.id
    reason = parsed.options[:reason]
    status = parsed.options[:status] || "closed"

    case transport do
      Ema.CLI.Transport.Direct ->
        with {:ok, loop} when not is_nil(loop) <-
               transport.call(Ema.Loops, :get_loop, [id]),
             {:ok, updated} <-
               transport.call(Ema.Loops, :close_loop, [
                 loop,
                 [status: status, reason: reason, closed_by: "human"]
               ]) do
          Output.success("Loop closed: #{updated.id} (#{status})")
          if opts[:json], do: Output.json(serialize(updated))
        else
          {:ok, nil} -> Output.error("Loop #{id} not found")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = Helpers.compact_map([{"reason", reason}, {"status", status}])

        case transport.post("/loops/#{id}/close", body) do
          {:ok, body} ->
            loop = Helpers.extract_record(body, "loop")
            Output.success("Loop closed: #{id}")
            if opts[:json], do: Output.json(loop)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:touch], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        with {:ok, loop} when not is_nil(loop) <-
               transport.call(Ema.Loops, :get_loop, [id]),
             {:ok, updated} <- transport.call(Ema.Loops, :touch_loop, [loop]) do
          Output.success("Touched #{id} (touches: #{updated.touch_count})")
          if opts[:json], do: Output.json(serialize(updated))
        else
          {:ok, nil} -> Output.error("Loop #{id} not found")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/loops/#{id}/touch", %{}) do
          {:ok, body} ->
            loop = Helpers.extract_record(body, "loop")
            Output.success("Touched #{id}")
            if opts[:json], do: Output.json(loop)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:stats], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Loops, :stats, []) do
          {:ok, stats} -> Output.detail(stats, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/loops/stats") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown loop subcommand: #{inspect(sub)}")
  end

  defp serialize(loop) do
    %{
      id: loop.id,
      loop_type: loop.loop_type,
      target: loop.target,
      context: loop.context,
      channel: loop.channel,
      opened_on: loop.opened_on,
      age_days: Ema.Loops.Loop.age_days(loop),
      escalation_level: loop.escalation_level,
      escalation_label: Ema.Loops.Loop.level_label(loop.escalation_level || 0),
      touch_count: loop.touch_count,
      status: loop.status,
      follow_up_text: loop.follow_up_text
    }
  end
end
