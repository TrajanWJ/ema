defmodule Ema.CLI.Commands.Meeting do
  @moduledoc "CLI commands for meeting management."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Date", :date},
    {"Time", :time},
    {"Status", :status},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Meetings, :list_meetings, []) do
          {:ok, meetings} -> Output.render(meetings, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/meetings") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "meetings"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Meetings, :get_meeting, [id]) do
          {:ok, nil} -> Output.error("Meeting #{id} not found")
          {:ok, meeting} -> Output.detail(meeting, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/meetings/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "meeting"), json: opts[:json])
          {:error, :not_found} -> Output.error("Meeting #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    title = parsed.args.title

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:title, title},
            {:date, parsed.options[:date]},
            {:time, parsed.options[:time]},
            {:description, parsed.options[:description]},
            {:attendees, parsed.options[:attendees]}
          ])

        case transport.call(Ema.Meetings, :create_meeting, [attrs]) do
          {:ok, meeting} ->
            Output.success("Created meeting: #{meeting.title}")
            if opts[:json], do: Output.json(meeting)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "meeting" =>
            Helpers.compact_map([
              {"title", title},
              {"date", parsed.options[:date]},
              {"time", parsed.options[:time]},
              {"description", parsed.options[:description]},
              {"attendees", parsed.options[:attendees]}
            ])
        }

        case transport.post("/meetings", body) do
          {:ok, resp} ->
            m = Helpers.extract_record(resp, "meeting")
            Output.success("Created meeting: #{m["title"]}")
            if opts[:json], do: Output.json(m)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:update], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:title, parsed.options[:title]},
            {:date, parsed.options[:date]},
            {:time, parsed.options[:time]},
            {:description, parsed.options[:description]},
            {:attendees, parsed.options[:attendees]}
          ])

        case transport.call(Ema.Meetings, :update_meeting, [id, attrs]) do
          {:ok, meeting} ->
            Output.success("Updated meeting: #{meeting.title}")
            if opts[:json], do: Output.json(meeting)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "meeting" =>
            Helpers.compact_map([
              {"title", parsed.options[:title]},
              {"date", parsed.options[:date]},
              {"time", parsed.options[:time]},
              {"description", parsed.options[:description]},
              {"attendees", parsed.options[:attendees]}
            ])
        }

        case transport.put("/meetings/#{id}", body) do
          {:ok, resp} ->
            m = Helpers.extract_record(resp, "meeting")
            Output.success("Updated meeting: #{m["title"]}")
            if opts[:json], do: Output.json(m)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Meetings, :delete_meeting, [id]) do
          {:ok, _} -> Output.success("Deleted meeting #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/meetings/#{id}") do
          {:ok, _} -> Output.success("Deleted meeting #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:upcoming], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Meetings, :upcoming, []) do
          {:ok, meetings} -> Output.render(meetings, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/meetings/upcoming") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "meetings"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown meeting subcommand: #{inspect(sub)}")
  end
end
