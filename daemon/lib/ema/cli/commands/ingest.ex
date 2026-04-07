defmodule Ema.CLI.Commands.Ingest do
  @moduledoc "CLI commands for ingest job management — CRUD."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Source", :source},
    {"Status", :status},
    {"Items", :item_count},
    {"Created", :inserted_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.IngestJobs, :list_jobs, []) do
          {:ok, jobs} -> Output.render(jobs, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/ingest-jobs") do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "jobs"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.IngestJobs, :get_job, [id]) do
          {:ok, nil} -> Output.error("Ingest job #{id} not found")
          {:ok, job} -> Output.detail(job, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/ingest-jobs/#{id}") do
          {:ok, body} -> Output.detail(Helpers.extract_record(body, "job"), json: opts[:json])
          {:error, :not_found} -> Output.error("Ingest job #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    source = parsed.args.source

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:source, source},
            {:config, parsed.options[:config]}
          ])

        case transport.call(Ema.IngestJobs, :create_job, [attrs]) do
          {:ok, job} ->
            Output.success("Created ingest job: #{job.id}")
            if opts[:json], do: Output.json(job)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "job" =>
            Helpers.compact_map([
              {"source", source},
              {"config", parsed.options[:config]}
            ])
        }

        case transport.post("/ingest-jobs", body) do
          {:ok, resp} ->
            j = Helpers.extract_record(resp, "job")
            Output.success("Created ingest job: #{j["id"]}")
            if opts[:json], do: Output.json(j)

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
            {:source, parsed.options[:source]},
            {:config, parsed.options[:config]},
            {:status, parsed.options[:status]}
          ])

        case transport.call(Ema.IngestJobs, :update_job, [id, attrs]) do
          {:ok, job} ->
            Output.success("Updated ingest job: #{job.id}")
            if opts[:json], do: Output.json(job)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{
          "job" =>
            Helpers.compact_map([
              {"source", parsed.options[:source]},
              {"config", parsed.options[:config]},
              {"status", parsed.options[:status]}
            ])
        }

        case transport.put("/ingest-jobs/#{id}", body) do
          {:ok, resp} ->
            j = Helpers.extract_record(resp, "job")
            Output.success("Updated ingest job: #{j["id"]}")
            if opts[:json], do: Output.json(j)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.IngestJobs, :delete_job, [id]) do
          {:ok, _} -> Output.success("Deleted ingest job #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/ingest-jobs/#{id}") do
          {:ok, _} -> Output.success("Deleted ingest job #{id}")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown ingest subcommand: #{inspect(sub)}")
  end
end
