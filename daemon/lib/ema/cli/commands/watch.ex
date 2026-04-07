defmodule Ema.CLI.Commands.Watch do
  @moduledoc "Live event stream from Phoenix PubSub. Ctrl+C to exit."

  alias Ema.CLI.Output

  @channel_topics %{
    "all" => [
      "babysitter:sessions",
      "brain_dump",
      "campaigns:events",
      "campaigns:updates",
      "channels:messages",
      "claude_sessions",
      "executions",
      "focus:updates",
      "goals",
      "intents",
      "pipes:monitor",
      "pipes:runs",
      "projects",
      "proposals:events",
      "proposals:pipeline",
      "task_events",
      "vault:changes"
    ],
    "babysitter" => ["babysitter:sessions"],
    "brain-dump" => ["brain_dump"],
    "campaigns" => ["campaigns:events", "campaigns:updates"],
    "channels" => ["channels:messages"],
    "executions" => ["executions"],
    "focus" => ["focus:updates"],
    "goals" => ["goals"],
    "intents" => ["intents"],
    "pipeline" => ["proposals:pipeline", "proposals:events"],
    "pipes" => ["pipes:monitor", "pipes:runs"],
    "projects" => ["projects"],
    "proposals" => ["proposals:pipeline", "proposals:events"],
    "sessions" => ["claude_sessions"],
    "tasks" => ["task_events"],
    "vault" => ["vault:changes"]
  }

  def handle([], parsed, transport, opts) do
    channel = parsed.options[:channel] || "all"
    format = parsed.options[:format] || "pretty"
    topics = Map.get(@channel_topics, channel)

    cond do
      is_nil(topics) ->
        Output.error("Unknown watch channel: #{channel}")

      transport == Ema.CLI.Transport.Http ->
        run_http_watch(channel, format, transport)

      opts[:json] ->
        Output.json(%{channel: channel, topics: topics, mode: "pubsub"})

      true ->
        run_watch(channel, topics, format)
    end
  end

  defp run_watch(channel, topics, format) do
    Process.flag(:trap_exit, true)
    parent = self()

    Enum.each(topics, fn topic ->
      spawn_link(fn -> subscribe_and_forward(parent, topic) end)
    end)

    IO.puts("EMA Watch #{channel}  Ctrl+C to exit")
    IO.puts(Enum.map_join(topics, ", ", & &1))
    IO.puts(String.duplicate("-", 80))

    receive_loop(format)
  end

  defp subscribe_and_forward(parent, topic) do
    Phoenix.PubSub.subscribe(Ema.PubSub, topic)
    relay(parent, topic)
  end

  defp relay(parent, topic) do
    receive do
      message ->
        send(parent, {:watch_event, topic, message})
        relay(parent, topic)
    end
  end

  defp receive_loop(format) do
    receive do
      {:watch_event, topic, message} ->
        event = normalize_event(topic, message)
        render_event(event, format)
        receive_loop(format)

      {:EXIT, _pid, _reason} ->
        receive_loop(format)
    end
  end

  defp run_http_watch(channel, format, transport) do
    IO.puts("EMA Watch #{channel} (HTTP polling, 3s interval)  Ctrl+C to exit")
    IO.puts(String.duplicate("-", 80))
    cursor = DateTime.utc_now() |> DateTime.to_iso8601()
    http_poll_loop(format, transport, cursor)
  end

  defp http_poll_loop(format, transport, cursor) do
    case transport.get("/babysitter/state") do
      {:ok, %{"events" => events}} ->
        new_events = events |> Enum.filter(fn e -> (e["at"] || "") > cursor end)

        Enum.each(new_events, fn e ->
          time = (e["at"] || "") |> String.slice(11, 8) || "??:??:??"
          topic = e["topic"] || "unknown"
          cat = category_for(topic)
          IO.puts("[#{time}] #{label_for(cat)} #{topic}")
          IO.puts("  #{inspect(e["event"], pretty: false, limit: 8)}")
        end)

        new_cursor = case List.last(new_events) do
          %{"at" => at} -> at
          _ -> cursor
        end

        Process.sleep(3_000)
        http_poll_loop(format, transport, new_cursor)

      {:error, reason} ->
        IO.puts("[error] #{inspect(reason)}")
        Process.sleep(5_000)
        http_poll_loop(format, transport, cursor)
    end
  end

  defp normalize_event(topic, message) do
    %{
      time: extract_time(message),
      topic: topic,
      category: category_for(topic),
      message: summarize(message)
    }
  end

  defp render_event(event, "compact") do
    IO.puts("[#{event.time}] #{event.topic} #{event.message}")
  end

  defp render_event(event, _format) do
    IO.puts("[#{event.time}] #{label_for(event.category)} #{event.topic}")
    IO.puts("  #{event.message}")
  end

  defp summarize({event, payload}) do
    "#{event} #{summarize(payload)}"
  end

  defp summarize({event, left, right}) do
    "#{event} #{summarize(left)} #{summarize(right)}"
  end

  defp summarize({event, a, b, c}) do
    "#{event} #{summarize(a)} #{summarize(b)} #{summarize(c)}"
  end

  defp summarize(%{event: event} = payload) do
    "#{event} #{inspect(Map.drop(payload, [:event]), pretty: false, limit: 8)}"
  end

  defp summarize(%_{} = struct) do
    struct
    |> Map.from_struct()
    |> Map.drop([:__meta__])
    |> summarize()
  end

  defp summarize(map) when is_map(map) do
    map
    |> Map.take([:id, :name, :title, :status, :phase, :project_id, :campaign_id, :execution_id])
    |> case do
      empty when map_size(empty) == 0 -> inspect(map, pretty: false, limit: 6)
      compact -> inspect(compact, pretty: false, limit: 6)
    end
  end

  defp summarize(list) when is_list(list), do: inspect(list, pretty: false, limit: 6)
  defp summarize(other), do: inspect(other, pretty: false, limit: 6)

  defp extract_time(%{inserted_at: value}) when not is_nil(value), do: format_time(value)
  defp extract_time(%{updated_at: value}) when not is_nil(value), do: format_time(value)
  defp extract_time(%{started_at: value}) when not is_nil(value), do: format_time(value)
  defp extract_time({_, payload}) when is_map(payload), do: extract_time(payload)
  defp extract_time(_), do: format_time(DateTime.utc_now())

  defp format_time(%DateTime{} = dt), do: dt |> DateTime.to_time() |> Time.to_string() |> String.slice(0, 8)

  defp format_time(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, dt, _} -> format_time(dt)
      _ -> String.slice(value, 11, 8) || value
    end
  end

  defp category_for("babysitter:" <> _), do: :babysitter
  defp category_for("brain_dump"), do: :brain_dump
  defp category_for("campaigns:" <> _), do: :campaign
  defp category_for("channels:" <> _), do: :channel
  defp category_for("claude_sessions"), do: :session
  defp category_for("executions"), do: :execution
  defp category_for("focus:" <> _), do: :focus
  defp category_for("goals" <> _), do: :goal
  defp category_for("intents"), do: :intent
  defp category_for("pipes:" <> _), do: :pipe
  defp category_for("projects"), do: :project
  defp category_for("proposals:" <> _), do: :proposal
  defp category_for("task_events"), do: :task
  defp category_for("vault:" <> _), do: :vault
  defp category_for(_), do: :event

  defp label_for(:babysitter), do: "BABY"
  defp label_for(:brain_dump), do: "DUMP"
  defp label_for(:campaign), do: "CAMP"
  defp label_for(:channel), do: "CHAN"
  defp label_for(:execution), do: "EXEC"
  defp label_for(:focus), do: "FOCS"
  defp label_for(:goal), do: "GOAL"
  defp label_for(:intent), do: "INTN"
  defp label_for(:pipe), do: "PIPE"
  defp label_for(:project), do: "PROJ"
  defp label_for(:proposal), do: "PROP"
  defp label_for(:session), do: "SESS"
  defp label_for(:task), do: "TASK"
  defp label_for(:vault), do: "VAUL"
  defp label_for(_), do: "EVNT"
end
