defmodule EmaCli.Superman do
  @moduledoc "CLI commands for the Superman intelligence layer"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, format_output: 2, error: 1, warn: 1, success: 1]

  def run("ask", opts) do
    question = Map.get(opts, :_arg) || error("Usage: ema superman ask <question>")

    IO.puts("Thinking...")

    case api_post("/superman/ask", %{question: question}) do
      {:ok, %{"response" => response}} ->
        IO.puts("\n#{response}")

      {:ok, %{"answer" => answer}} ->
        IO.puts("\n#{answer}")

      {:ok, result} when is_binary(result) ->
        IO.puts("\n#{result}")

      {:ok, result} when is_map(result) ->
        IO.puts("\n#{Jason.encode!(result, pretty: true)}")

      {:error, msg} ->
        error(msg)
    end
  end

  def run("context", opts) do
    project = Map.get(opts, :project) || Map.get(opts, :_arg)

    result =
      if project do
        api_get("/superman/context/#{URI.encode(project)}")
      else
        api_post("/superman/context", %{})
      end

    case result do
      {:ok, ctx} when is_map(ctx) ->
        IO.puts("\n\e[1mContext Bundle\e[0m")

        Enum.each(ctx, fn {key, val} ->
          display =
            cond do
              is_binary(val) -> String.slice(val, 0, 80)
              is_list(val) -> "#{length(val)} items"
              is_map(val) -> "#{map_size(val)} keys"
              true -> inspect(val)
            end

          IO.puts("  #{String.pad_trailing(to_string(key), 20)} #{display}")
        end)

      {:error, _} ->
        warn("Superman context not available")
    end
  end

  def run("health", _opts) do
    case api_get("/superman/health") do
      {:ok, health} when is_map(health) ->
        IO.puts("\n\e[1mSuperman Health\e[0m")

        Enum.each(health, fn {component, status} ->
          icon =
            if status in ["ok", "healthy", true, "up"],
              do: "\e[32m+\e[0m",
              else: "\e[31mx\e[0m"

          IO.puts("  #{icon} #{String.pad_trailing(to_string(component), 20)} #{status}")
        end)

      {:error, _} ->
        warn("Superman health not available")
    end
  end

  def run("index", opts) do
    force = Map.get(opts, :force, false)
    IO.puts("Indexing#{if force, do: " (force rebuild)", else: ""}...")

    case api_post("/superman/index", %{force: force}) do
      {:ok, result} ->
        count = result["indexed"] || result["count"] || 0
        success("Indexed #{count} item(s)")

      {:error, msg} ->
        error(msg)
    end
  end

  def run("gaps", opts) do
    case api_get("/superman/gaps") do
      {:ok, %{"gaps" => gaps}} -> format_output(gaps, opts)
      {:ok, gaps} when is_list(gaps) -> format_output(gaps, opts)
      {:ok, data} when is_map(data) -> format_output([data], opts)
      {:error, _} -> warn("Superman gaps not available")
    end
  end

  def run("flows", opts) do
    case api_get("/superman/flows") do
      {:ok, %{"flows" => flows}} -> format_output(flows, opts)
      {:ok, flows} when is_list(flows) -> format_output(flows, opts)
      {:ok, data} when is_map(data) -> format_output([data], opts)
      {:error, _} -> warn("Superman flows not available")
    end
  end

  def run(unknown, _),
    do: error("Unknown superman subcommand: #{unknown}. Try: ask, context, health, index, gaps, flows")
end
