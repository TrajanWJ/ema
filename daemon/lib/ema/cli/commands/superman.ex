defmodule Ema.CLI.Commands.Superman do
  @moduledoc "CLI commands for code intelligence (Superman)."

  alias Ema.CLI.{Helpers, Output}

  def handle([:health], _parsed, transport, opts) do
    http_get(transport, "/superman/health", opts)
  end

  def handle([:status], _parsed, transport, opts) do
    http_get(transport, "/superman/status", opts)
  end

  def handle([:context], parsed, transport, opts) do
    slug = parsed.args.slug
    http_get(transport, "/superman/context/#{slug}", opts)
  end

  def handle([:ask], parsed, transport, opts) do
    question = parsed.args.question
    project = parsed.options[:project]
    body = Helpers.compact_map([{"question", question}, {"project_slug", project}])

    case transport.post("/superman/ask", body) do
      {:ok, resp} ->
        answer = resp["answer"] || resp["response"] || inspect(resp)
        if opts[:json], do: Output.json(resp), else: IO.puts(answer)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:gaps], parsed, transport, opts) do
    params = Helpers.compact_keyword([{:project_slug, parsed.options[:project]}])
    http_get(transport, "/superman/gaps", opts, params)
  end

  def handle([:index], parsed, transport, _opts) do
    body = Helpers.compact_map([{"project_slug", parsed.options[:project]}])

    case transport.post("/superman/index", body) do
      {:ok, _} -> Output.success("Indexing started")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown superman subcommand: #{inspect(sub)}")
  end

  defp http_get(transport, path, opts, params \\ []) do
    case transport.get(path, params: params) do
      {:ok, body} ->
        if opts[:json], do: Output.json(body), else: Output.detail(body)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end
end
