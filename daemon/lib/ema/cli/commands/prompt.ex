defmodule Ema.CLI.Commands.Prompt do
  @moduledoc "CLI commands for prompt management — CRUD and versioning."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Version", :version},
    {"Status", :status},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Prompts, :list_prompts, []) do
          {:ok, prompts} -> Output.render(prompts, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/prompts") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "prompts"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Prompts, :get_prompt, [id]) do
          {:ok, nil} -> Output.error("Prompt #{id} not found")
          {:ok, prompt} -> Output.detail(prompt, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/prompts/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "prompt"), json: opts[:json])
          {:error, :not_found} -> Output.error("Prompt #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    name = parsed.args.name

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:name, name},
            {:content, parsed.options[:content]},
            {:description, parsed.options[:description]}
          ])

        case transport.call(Ema.Prompts, :create_prompt, [attrs]) do
          {:ok, prompt} ->
            Output.success("Created prompt: #{prompt.name}")
            if opts[:json], do: Output.json(prompt)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "prompt" =>
            Helpers.compact_map([
              {"name", name},
              {"content", parsed.options[:content]},
              {"description", parsed.options[:description]}
            ])
        }

        case transport.post("/prompts", body) do
          {:ok, resp} ->
            p = Helpers.extract_record(resp, "prompt")
            Output.success("Created prompt: #{p["name"]}")
            if opts[:json], do: Output.json(p)

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
            {:name, parsed.options[:name]},
            {:content, parsed.options[:content]},
            {:description, parsed.options[:description]}
          ])

        case transport.call(Ema.Prompts, :update_prompt, [id, attrs]) do
          {:ok, prompt} ->
            Output.success("Updated prompt: #{prompt.name}")
            if opts[:json], do: Output.json(prompt)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "prompt" =>
            Helpers.compact_map([
              {"name", parsed.options[:name]},
              {"content", parsed.options[:content]},
              {"description", parsed.options[:description]}
            ])
        }

        case transport.put("/prompts/#{id}", body) do
          {:ok, resp} ->
            p = Helpers.extract_record(resp, "prompt")
            Output.success("Updated prompt: #{p["name"]}")
            if opts[:json], do: Output.json(p)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Prompts, :delete_prompt, [id]) do
          {:ok, _} -> Output.success("Deleted prompt #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/prompts/#{id}") do
          {:ok, _} -> Output.success("Deleted prompt #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:version], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Prompts, :create_version, [id]) do
          {:ok, version} ->
            Output.success("Created version for prompt #{id}")
            if opts[:json], do: Output.json(version)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/prompts/#{id}/version", %{}) do
          {:ok, resp} ->
            Output.success("Created version for prompt #{id}")
            if opts[:json], do: Output.json(resp)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown prompt subcommand: #{inspect(sub)}")
  end
end
