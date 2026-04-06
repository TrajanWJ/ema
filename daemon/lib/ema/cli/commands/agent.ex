defmodule Ema.CLI.Commands.Agent do
  @moduledoc "CLI commands for agent management and chat."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Slug", :slug},
    {"Name", :name},
    {"Model", :model},
    {"Status", :status}
  ]

  @conversation_columns [
    {"ID", :id},
    {"Agent", :agent_id},
    {"Channel", :channel_type},
    {"Messages", :message_count},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Agents, :list_agents, []) do
          {:ok, agents} -> Output.render(agents, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/agents") do
          {:ok, body} -> Output.render(Helpers.extract_list(body, "agents"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    slug = parsed.args.slug

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Agents, :get_agent_by_slug, [slug]) do
          {:ok, nil} -> Output.error("Agent '#{slug}' not found")
          {:ok, agent} -> Output.detail(agent, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/agents/#{slug}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "agent"), json: opts[:json])
          {:error, :not_found} -> Output.error("Agent '#{slug}' not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:chat], parsed, transport, opts) do
    slug = parsed.args.slug
    message = parsed.args.message
    context = parsed.options[:context]

    case transport do
      Ema.CLI.Transport.Direct ->
        # AgentWorker handles chat via the API channel
        body = %{"message" => message}
        body = if context, do: Map.put(body, "context", context), else: body

        case Ema.CLI.Transport.Http.post("/agents/#{slug}/chat", body) do
          {:ok, %{"reply" => reply}} ->
            IO.puts(reply)
            if opts[:json], do: Output.json(%{slug: slug, message: message, reply: reply})

          {:ok, response} ->
            reply = response["response"] || response["reply"] || inspect(response)
            IO.puts(reply)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"message" => message}
        body = if context, do: Map.put(body, "context", context), else: body

        case transport.post("/agents/#{slug}/chat", body) do
          {:ok, %{"reply" => reply}} -> IO.puts(reply)
          {:ok, response} -> IO.puts(response["response"] || inspect(response))
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:conversations], parsed, transport, opts) do
    slug = parsed.args.slug

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Agents, :get_agent_by_slug, [slug]) do
          {:ok, nil} ->
            Output.error("Agent '#{slug}' not found")

          {:ok, agent} ->
            case transport.call(Ema.Agents, :list_conversations_by_agent, [agent.id]) do
              {:ok, convos} ->
                Output.render(convos, @conversation_columns, json: opts[:json])

              {:error, reason} ->
                Output.error(reason)
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/agents/#{slug}/conversations") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "conversations"), @conversation_columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown agent subcommand: #{inspect(sub)}")
  end
end
