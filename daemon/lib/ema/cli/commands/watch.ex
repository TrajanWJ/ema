defmodule Ema.CLI.Commands.Watch do
  @moduledoc "Live event stream from Phoenix PubSub. Ctrl+C to exit."

  alias Ema.CLI.Output

  @channel_topics %{
    "all" => [
      "babysitter:sessions",
      "campaigns:events",
      "campaigns:updates",
      "channels:messages",
      "executions",
      "focus:updates",
      "goals:updates",
      "pipes:monitor",
      "proposals:pipeline",
      "vault:changes",
      "pipe_trigger:tasks:created",
      "pipe_trigger:tasks:completed"
    ],
    "babysitter" => ["babysitter:sessions"],
    "campaigns" => ["campaigns:events", "campaigns:updates"],
    "channels" => ["channels:messages"],
    "executions" => ["executions"],
    "focus" => ["focus:updates"],
    "goals" => ["goals:updates"],
    "pipes" => ["pipes:monitor"],
    "proposals" => ["proposals:pipeline"],
    "tasks" => ["pipe_trigger:tasks:created", "pipe_trigger:tasks:completed"],
    "vault" => ["vault:changes"]
  }

  def handle([], parsed, transport, opts) do
    channel = parsed.options[:channel] || "all"
    format = parsed.options[:format] || "pretty"
    topics = Map.get(@channel_topics, channel)

    cond do
      is_nil(topics) ->
        Output.error("Unknown watch channel: #{channel}")

      transport != Ema.CLI.Transport.Direct ->
        Output.error("watch requires a direct runtime; HTTP polling mode was removed")

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
  defp category_for("campaigns:" <> _), do: :campaign
  defp category_for("channels:" <> _), do: :channel
  defp category_for("executions"), do: :execution
  defp category_for("focus:" <> _), do: :focus
  defp category_for("goals:" <> _), do: :goal
  defp category_for("pipes:" <> _), do: :pipe
  defp category_for("proposals:" <> _), do: :proposal
  defp category_for("vault:" <> _), do: :vault
  defp category_for("pipe_trigger:tasks:" <> _), do: :task
  defp category_for(_), do: :event

  defp label_for(:babysitter), do: "BABY"
  defp label_for(:campaign), do: "CAMP"
  defp label_for(:channel), do: "CHAN"
  defp label_for(:execution), do: "EXEC"
  defp label_for(:focus), do: "FOCS"
  defp label_for(:goal), do: "GOAL"
  defp label_for(:pipe), do: "PIPE"
  defp label_for(:proposal), do: "PROP"
  defp label_for(:task), do: "TASK"
  defp label_for(:vault), do: "VAUL"
  defp label_for(_), do: "EVNT"
end
