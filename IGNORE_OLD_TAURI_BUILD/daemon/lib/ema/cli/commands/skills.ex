defmodule Ema.CLI.Commands.Skills do
  @moduledoc """
  CLI commands for the agent skills ecosystem.

  Skills are SKILL.md files under `~/.local/share/ema/vault/wiki/Skills/<slug>/`.
  This command operates on the filesystem directly via `Ema.Skills` — no
  daemon round-trip required, so it works with both Direct and Http transports.
  """

  alias Ema.CLI.Output
  alias Ema.Skills

  @columns [
    {"Name", :name},
    {"Slug", :slug},
    {"Triggers", :trigger_summary},
    {"Description", :description},
    {"Valid", :valid_marker}
  ]

  def handle([:list], _parsed, _transport, opts) do
    rows =
      Skills.list_all()
      |> Enum.map(&row/1)

    Output.render(rows, @columns, json: opts[:json])
  end

  def handle([:show], parsed, _transport, opts) do
    name = parsed.args.name

    case Skills.get(name) do
      {:ok, skill} ->
        if opts[:json] do
          Output.json(%{
            name: skill.name,
            slug: skill.slug,
            description: skill.description,
            triggers: skill.triggers,
            path: skill.path,
            valid: skill.valid?,
            errors: skill.errors,
            content: skill.content
          })
        else
          IO.puts("# #{skill.name}")
          IO.puts("path:        #{skill.path}")
          IO.puts("description: #{skill.description}")
          IO.puts("triggers:    #{Enum.join(skill.triggers, ", ")}")
          IO.puts("valid:       #{skill.valid?}")

          if skill.errors != [] do
            IO.puts("errors:")
            Enum.each(skill.errors, &IO.puts("  - #{&1}"))
          end

          IO.puts("")
          IO.puts(skill.content)
        end

      {:error, :not_found} ->
        Output.error("Skill #{inspect(name)} not found")
    end
  end

  def handle([:validate], _parsed, _transport, opts) do
    results = Skills.validate_all()

    if opts[:json] do
      Output.json(
        Enum.map(results, fn
          {:ok, s} -> %{name: s.name, valid: true, errors: []}
          {:error, s, errors} -> %{name: s.name, valid: false, errors: errors}
        end)
      )
    else
      Enum.each(results, fn
        {:ok, s} ->
          IO.puts("  ok    #{s.name}")

        {:error, s, errors} ->
          IO.puts("  FAIL  #{s.name}")
          Enum.each(errors, &IO.puts("        - #{&1}"))
      end)

      total = length(results)
      bad = Enum.count(results, &match?({:error, _, _}, &1))
      IO.puts("")
      IO.puts("#{total - bad}/#{total} skills valid")

      if bad > 0, do: System.halt(1)
    end
  end

  def handle([:load], parsed, _transport, opts) do
    query = parsed.args.query
    relevant = Skills.find_relevant(query, 5)

    if opts[:json] do
      Output.json(
        Enum.map(relevant, fn s ->
          %{name: s.name, slug: s.slug, description: s.description, triggers: s.triggers}
        end)
      )
    else
      case relevant do
        [] ->
          IO.puts("(no skills matched)")

        skills ->
          IO.puts("Would auto-load for: #{inspect(query)}\n")

          Enum.each(skills, fn s ->
            IO.puts("  - #{s.name}")
            IO.puts("    #{s.description}")
          end)

          chars = byte_size(Skills.auto_load_for_prompt(query))
          IO.puts("\nInjected block: ~#{chars} chars")
      end
    end
  end

  def handle(_, _, _, _opts) do
    Output.error("usage: ema skills [list|show <name>|validate|load <query>]")
  end

  defp row(skill) do
    %{
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      trigger_summary: skill.triggers |> Enum.take(3) |> Enum.join(", "),
      valid_marker: if(skill.valid?, do: "ok", else: "FAIL")
    }
  end
end
