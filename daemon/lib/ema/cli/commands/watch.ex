defmodule Ema.CLI.Commands.Watch do
  @moduledoc """
  Live event stream — polls daemon endpoints and renders a scrolling
  event log with Owl.LiveScreen. Ctrl+C to exit.

  Channels: all, babysitter, proposals, executions, focus, tasks, agents
  """

  alias Ema.CLI.Output

  @default_interval 5_000
  @max_events 30

  def handle([], parsed, _transport, opts) do
    channel = parsed.options[:channel] || "all"
    interval = (parsed.options[:interval] || 5) * 1000

    if opts[:json] do
      # Single-shot JSON mode — no live rendering
      events = poll_all()
      Output.json(events)
    else
      run_live(channel, interval)
    end
  end

  defp run_live(channel, interval) do
    width =
      case :io.columns() do
        {:ok, w} -> w
        _ -> 80
      end

    case Owl.LiveScreen.start_link(refresh_every: 100, terminal_width: width) do
      {:ok, _} ->
        Owl.LiveScreen.add_block(:header, state: render_header(channel, interval))

        Owl.LiveScreen.add_block(:events,
          state: [],
          render: fn events -> render_events(events) end
        )

        Owl.LiveScreen.add_block(:status,
          state: %{tick: 0, last_poll: nil},
          render: fn st -> render_status_bar(st) end
        )

        IO.write(IO.ANSI.clear())
        loop(channel, interval, [], 0)

      :ignore ->
        # No terminal — fall back to scrolling output
        run_scrolling(channel, interval)
    end
  end

  defp run_scrolling(channel, interval) do
    IO.puts(IO.ANSI.clear())
    header = "EMA Watch — #{channel} (#{div(interval, 1000)}s refresh) Ctrl+C to exit"
    IO.puts(IO.ANSI.cyan() <> header <> IO.ANSI.reset())
    IO.puts(String.duplicate("─", 60))
    scrolling_loop(channel, interval, MapSet.new())
  end

  defp scrolling_loop(channel, interval, seen) do
    events = poll_channel(channel)

    new_events = Enum.reject(events, fn e -> MapSet.member?(seen, event_id(e)) end)

    new_seen =
      Enum.reduce(new_events, seen, fn e, acc -> MapSet.put(acc, event_id(e)) end)

    Enum.each(Enum.reverse(new_events), fn e ->
      time = format_time(e.time)
      cat = category_ansi(e.category)
      msg = String.slice(e.message, 0, 70)
      IO.puts("#{IO.ANSI.faint()}#{time}#{IO.ANSI.reset()} #{cat} #{msg}")
    end)

    Process.sleep(interval)
    scrolling_loop(channel, interval, new_seen)
  end

  defp loop(channel, interval, prev_events, tick) do
    new_events = poll_channel(channel)

    merged =
      (new_events ++ prev_events)
      |> Enum.uniq_by(&event_id/1)
      |> Enum.take(@max_events)

    Owl.LiveScreen.update(:events, merged)
    Owl.LiveScreen.update(:status, %{tick: tick + 1, last_poll: now_str()})

    Process.sleep(interval)
    loop(channel, interval, merged, tick + 1)
  rescue
    _ ->
      Owl.LiveScreen.flush()
      IO.puts("\nWatch ended.")
  end

  # -- Polling --

  defp poll_channel("all"), do: poll_all()
  defp poll_channel("babysitter"), do: poll_babysitter()
  defp poll_channel("proposals"), do: poll_proposals()
  defp poll_channel("executions"), do: poll_executions()
  defp poll_channel("focus"), do: poll_focus()
  defp poll_channel("tasks"), do: poll_tasks()
  defp poll_channel("agents"), do: poll_agents()
  defp poll_channel("pipeline"), do: poll_proposals()
  defp poll_channel("inbox"), do: poll_inbox()
  defp poll_channel(other), do: [make_event(:warn, "Unknown channel: #{other}")]

  defp poll_all do
    Enum.flat_map(
      [&poll_babysitter/0, &poll_executions/0, &poll_proposals/0, &poll_focus/0, &poll_tasks/0],
      fn f ->
        try do
          f.()
        rescue
          _ -> []
        end
      end
    )
    |> Enum.sort_by(& &1.time, :desc)
    |> Enum.take(@max_events)
  end

  defp poll_babysitter do
    case http_get("/babysitter/state") do
      {:ok, body} ->
        events = body["events"] || []

        Enum.map(events, fn e ->
          %{
            id: e["id"] || e["timestamp"],
            time: e["timestamp"] || e["inserted_at"] || now_str(),
            category: :babysitter,
            message: e["message"] || e["summary"] || e["content"] || inspect(e)
          }
        end)

      _ ->
        []
    end
  end

  defp poll_executions do
    case http_get("/executions", params: [limit: 8]) do
      {:ok, body} ->
        execs = extract_list(body, "executions")

        Enum.map(execs, fn e ->
          status = e["status"] || "unknown"
          title = e["title"] || e["objective"] || e["id"]

          %{
            id: e["id"],
            time: e["updated_at"] || e["inserted_at"] || now_str(),
            category: :execution,
            message: "[#{status}] #{title}"
          }
        end)

      _ ->
        []
    end
  end

  defp poll_proposals do
    case http_get("/proposals", params: [limit: 8]) do
      {:ok, body} ->
        props = extract_list(body, "proposals")

        Enum.map(props, fn p ->
          status = p["status"] || "unknown"
          title = p["title"] || p["id"]

          %{
            id: p["id"],
            time: p["updated_at"] || p["inserted_at"] || now_str(),
            category: :proposal,
            message: "[#{status}] #{title}"
          }
        end)

      _ ->
        []
    end
  end

  defp poll_focus do
    case http_get("/focus/current") do
      {:ok, body} ->
        phase = body["phase"] || body["status"] || "idle"
        elapsed = body["elapsed_ms"] || 0
        min = div(elapsed, 60_000)

        if phase != "idle" do
          [%{
            id: "focus-current",
            time: now_str(),
            category: :focus,
            message: "#{phase} — #{min}m elapsed"
          }]
        else
          []
        end

      _ ->
        []
    end
  end

  defp poll_tasks do
    case http_get("/tasks", params: [limit: 5]) do
      {:ok, body} ->
        tasks = extract_list(body, "tasks")

        tasks
        |> Enum.filter(fn t -> t["status"] in ["in_progress", "active", "running"] end)
        |> Enum.map(fn t ->
          %{
            id: t["id"],
            time: t["updated_at"] || now_str(),
            category: :task,
            message: "[#{t["status"]}] #{t["title"]}"
          }
        end)

      _ ->
        []
    end
  end

  defp poll_agents do
    case http_get("/agents") do
      {:ok, body} ->
        agents = extract_list(body, "agents")

        Enum.map(agents, fn a ->
          %{
            id: a["id"],
            time: now_str(),
            category: :agent,
            message: "#{a["name"] || a["slug"]} (#{a["status"] || "unknown"})"
          }
        end)

      _ ->
        []
    end
  end

  defp poll_inbox do
    case http_get("/channels/inbox") do
      {:ok, body} ->
        msgs = extract_list(body, "messages")

        Enum.map(msgs, fn m ->
          %{
            id: m["id"] || m["inserted_at"],
            time: m["inserted_at"] || now_str(),
            category: :message,
            message: "#{m["sender_name"] || "?"}: #{m["content"] || ""}"
          }
        end)

      _ ->
        []
    end
  end

  # -- Rendering --

  defp render_header(channel, interval) do
    seconds = div(interval, 1000)

    [
      Owl.Data.tag("EMA Watch", [:bright, :cyan]),
      Owl.Data.tag(" — ", :white),
      Owl.Data.tag(channel, :yellow),
      Owl.Data.tag(" (#{seconds}s refresh) ", :white),
      Owl.Data.tag("Ctrl+C to exit", :faint),
      "\n",
      Owl.Data.tag(String.duplicate("─", 60), :faint)
    ]
  end

  defp render_events([]) do
    Owl.Data.tag("  Waiting for events...", :faint)
  end

  defp render_events(events) do
    events
    |> Enum.take(@max_events)
    |> Enum.map(fn e ->
      time = format_time(e.time)
      cat = category_tag(e.category)
      msg = String.slice(e.message, 0, 70)

      [
        Owl.Data.tag(time, :faint),
        " ",
        cat,
        " ",
        msg
      ]
    end)
    |> Enum.intersperse("\n")
  end

  defp render_status_bar(st) do
    [
      "\n",
      Owl.Data.tag(String.duplicate("─", 60), :faint),
      "\n",
      Owl.Data.tag("tick: #{st.tick}", :faint),
      "  ",
      Owl.Data.tag("last: #{st.last_poll || "-"}", :faint)
    ]
  end

  defp category_tag(:babysitter), do: Owl.Data.tag("BABY", :magenta)
  defp category_tag(:execution), do: Owl.Data.tag("EXEC", :cyan)
  defp category_tag(:proposal), do: Owl.Data.tag("PROP", :yellow)
  defp category_tag(:focus), do: Owl.Data.tag("FOCS", :green)
  defp category_tag(:task), do: Owl.Data.tag("TASK", :blue)
  defp category_tag(:agent), do: Owl.Data.tag("AGNT", :light_cyan)
  defp category_tag(:message), do: Owl.Data.tag("MESG", :light_green)
  defp category_tag(:warn), do: Owl.Data.tag("WARN", :red)
  defp category_tag(_), do: Owl.Data.tag("????", :faint)

  defp category_ansi(:babysitter), do: IO.ANSI.magenta() <> "BABY" <> IO.ANSI.reset()
  defp category_ansi(:execution), do: IO.ANSI.cyan() <> "EXEC" <> IO.ANSI.reset()
  defp category_ansi(:proposal), do: IO.ANSI.yellow() <> "PROP" <> IO.ANSI.reset()
  defp category_ansi(:focus), do: IO.ANSI.green() <> "FOCS" <> IO.ANSI.reset()
  defp category_ansi(:task), do: IO.ANSI.blue() <> "TASK" <> IO.ANSI.reset()
  defp category_ansi(:agent), do: IO.ANSI.light_cyan() <> "AGNT" <> IO.ANSI.reset()
  defp category_ansi(:message), do: IO.ANSI.light_green() <> "MESG" <> IO.ANSI.reset()
  defp category_ansi(:warn), do: IO.ANSI.red() <> "WARN" <> IO.ANSI.reset()
  defp category_ansi(_), do: IO.ANSI.faint() <> "????" <> IO.ANSI.reset()

  # -- Helpers --

  defp format_time(nil), do: "     "

  defp format_time(iso) when is_binary(iso) do
    case DateTime.from_iso8601(iso) do
      {:ok, dt, _} ->
        dt
        |> DateTime.to_time()
        |> Time.to_string()
        |> String.slice(0, 8)

      _ ->
        String.slice(iso, 11, 8)
    end
  end

  defp format_time(_), do: "     "

  defp now_str, do: DateTime.to_iso8601(DateTime.utc_now())

  defp event_id(%{id: id}) when not is_nil(id), do: id
  defp event_id(e), do: {e.category, e.message}

  defp make_event(category, message) do
    %{id: nil, time: now_str(), category: category, message: message}
  end

  defp http_get(path, opts \\ []) do
    Ema.CLI.Transport.Http.get(path, opts)
  end

  defp extract_list(body, key) when is_map(body) do
    Map.get(body, key) || Map.get(body, "data") || [body]
  end

  defp extract_list(body, _key) when is_list(body), do: body
end
