defmodule EmaCli.Channel do
  @moduledoc "CLI commands for messaging channels"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, format_output: 2, error: 1, warn: 1, success: 1]

  def run("list", opts) do
    case api_get("/channels") do
      {:ok, %{"channels" => channels}} -> format_output(channels, opts)
      {:ok, channels} when is_list(channels) -> format_output(channels, opts)
      {:error, msg} -> error(msg)
    end
  end

  def run("health", _opts) do
    case api_get("/channels/health") do
      {:ok, health} when is_map(health) ->
        IO.puts("\n\e[1mChannel Health\e[0m")

        Enum.each(health, fn {name, status} ->
          icon = if status in ["ok", "healthy", true], do: "\e[32m+\e[0m", else: "\e[31mx\e[0m"
          IO.puts("  #{icon} #{String.pad_trailing(to_string(name), 20)} #{status}")
        end)

      {:ok, data} when is_list(data) ->
        Enum.each(data, fn ch ->
          status = ch["status"] || "unknown"
          icon = if status in ["ok", "healthy"], do: "\e[32m+\e[0m", else: "\e[31mx\e[0m"
          IO.puts("  #{icon} #{String.pad_trailing(ch["name"] || ch["id"] || "?", 20)} #{status}")
        end)

      {:error, _} ->
        warn("Channel health not available")
    end
  end

  def run("inbox", opts) do
    case api_get("/channels/inbox") do
      {:ok, %{"messages" => messages}} -> format_output(messages, opts)
      {:ok, messages} when is_list(messages) -> format_output(messages, opts)
      {:error, _} -> warn("Inbox not available")
    end
  end

  def run("send", opts) do
    # Expects: ema channel send <channel_id> --message="text"
    channel_id = Map.get(opts, :_arg) || error("Usage: ema channel send <channel_id> --message=\"text\"")
    message = Map.get(opts, :message) || error("Usage: ema channel send <channel_id> --message=\"text\"")

    case api_post("/channels/#{channel_id}/messages", %{message: %{content: message}}) do
      {:ok, _} -> success("Message sent to channel #{channel_id}")
      {:error, msg} -> error(msg)
    end
  end

  def run("messages", opts) do
    channel_id = Map.get(opts, :_arg) || error("Usage: ema channel messages <channel_id>")
    limit = Map.get(opts, :limit, "20")

    case api_get("/channels/#{channel_id}/messages?limit=#{limit}") do
      {:ok, %{"messages" => messages}} -> format_output(messages, opts)
      {:ok, messages} when is_list(messages) -> format_output(messages, opts)
      {:error, msg} -> error(msg)
    end
  end

  def run(unknown, _),
    do: error("Unknown channel subcommand: #{unknown}. Try: list, health, inbox, send, messages")
end
