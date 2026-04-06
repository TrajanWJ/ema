defmodule Ema.CLI.Commands.Channel do
  @moduledoc "CLI commands for unified channels/inbox."

  alias Ema.CLI.{Helpers, Output}

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Http ->
        case transport.get("/channels") do
          {:ok, body} ->
            if opts[:json] do
              Output.json(body)
            else
              servers = body["servers"] || []
              Output.info("Channels (#{length(servers)} servers)")

              Enum.each(servers, fn s ->
                IO.puts("  #{s["name"]} (#{s["type"]})")
              end)
            end

          {:error, reason} ->
            Output.error(reason)
        end

      _ ->
        # Channels are controller-driven, use HTTP
        Ema.CLI.Transport.Http.get("/channels")
        |> handle_http_response(opts, fn body ->
          if opts[:json] do
            Output.json(body)
          else
            servers = body["servers"] || []
            Output.info("Channels (#{length(servers)} servers)")
            Enum.each(servers, fn s -> IO.puts("  #{s["name"]} (#{s["type"]})") end)
          end
        end)
    end
  end

  def handle([:health], _parsed, transport, opts) do
    case transport.get("/channels/health") do
      {:ok, body} ->
        if opts[:json], do: Output.json(body), else: Output.detail(body)

      {:error, reason} ->
        Output.error(reason)
    end
  end

  def handle([:inbox], _parsed, transport, opts) do
    msg_cols = [
      {"From", :sender_name},
      {"Channel", :channel_id},
      {"Content", :content},
      {"Time", :inserted_at}
    ]

    case transport.get("/channels/inbox") do
      {:ok, body} ->
        Output.render(Helpers.extract_list(body, "messages"), msg_cols, json: opts[:json])

      {:error, reason} ->
        Output.error(reason)
    end
  end

  def handle([:send], parsed, transport, _opts) do
    channel = parsed.args.channel
    message = parsed.args.message

    case transport.post("/channels/#{channel}/messages", %{"content" => message}) do
      {:ok, _} -> Output.success("Sent to #{channel}")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown channel subcommand: #{inspect(sub)}")
  end

  defp handle_http_response({:ok, body}, _opts, render_fn), do: render_fn.(body)
  defp handle_http_response({:error, reason}, _opts, _render_fn), do: Output.error(reason)
end
