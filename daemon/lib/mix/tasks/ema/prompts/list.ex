defmodule Mix.Tasks.Ema.Prompts.List do
  @shortdoc "List all active prompts with kind, version, and content preview"
  @moduledoc """
  Lists all active prompts stored in the database.

      mix ema.prompts.list
      mix ema.prompts.list --all       # include archived/testing
      mix ema.prompts.list --kind soul  # filter by kind
  """

  use Mix.Task

  def run(args) do
    {opts, _rest, _invalid} =
      OptionParser.parse(args,
        switches: [all: :boolean, kind: :string],
        aliases: [a: :all, k: :kind]
      )

    Mix.Task.run("app.start")

    prompts = fetch_prompts(opts)

    if prompts == [] do
      Mix.shell().info("No prompts found.")
    else
      Mix.shell().info("#{length(prompts)} prompt(s):\n")

      Enum.each(prompts, fn prompt ->
        preview =
          prompt.content
          |> String.split("\n")
          |> Enum.take(2)
          |> Enum.join(" ")
          |> String.slice(0, 80)

        status_tag = if prompt.status != "active", do: " [#{prompt.status}]", else: ""
        ab_tag = if prompt.a_b_test_group, do: " (#{prompt.a_b_test_group})", else: ""

        Mix.shell().info("""
          #{prompt.kind} v#{prompt.version}#{status_tag}#{ab_tag}
            #{preview}...
            id: #{prompt.id}
        """)
      end)
    end
  end

  defp fetch_prompts(opts) do
    alias Ema.Prompts.Store

    cond do
      opts[:kind] ->
        Store.list_prompts_by_kind(opts[:kind])

      opts[:all] ->
        Store.list_prompts()

      true ->
        Store.list_latest_per_kind()
    end
  end
end
