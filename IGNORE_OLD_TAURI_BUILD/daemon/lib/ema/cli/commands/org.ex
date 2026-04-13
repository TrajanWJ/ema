defmodule Ema.CLI.Commands.Org do
  @moduledoc "CLI commands for organization management."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"Name", :name}, {"Updated", :updated_at}]

  def handle([:list], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/orgs") do
      {:ok, body} ->
        Output.render(Helpers.extract_list(body, "orgs"), @columns, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:show], parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/orgs/#{parsed.args.id}") do
      {:ok, body} -> Output.detail(Helpers.extract_record(body, "org"), json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:create], parsed, _transport, opts) do
    body = %{"org" => %{"name" => parsed.args.name}}

    case Ema.CLI.Transport.Http.post("/orgs", body) do
      {:ok, resp} ->
        org = Helpers.extract_record(resp, "org")
        Output.success("Created org: #{org["name"]}")
        if opts[:json], do: Output.json(org)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:invite], parsed, _transport, _opts) do
    case Ema.CLI.Transport.Http.post("/orgs/#{parsed.args.id}/invitations", %{}) do
      {:ok, resp} ->
        token = resp["token"] || "created"
        Output.success("Invitation created: #{token}")

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown org subcommand: #{inspect(sub)}")
  end
end
