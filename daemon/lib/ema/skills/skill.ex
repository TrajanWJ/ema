defmodule Ema.Skills.Skill do
  @moduledoc """
  In-memory representation of a parsed SKILL.md file.

  Skills live in `~/.local/share/ema/vault/wiki/Skills/<slug>/SKILL.md` and follow
  the promethos contract:

      ---
      name: skill-name
      description: One-line summary, name + description ≤ 250 chars
      triggers:
        - keyword one
        - keyword two
      ---

      # Goal
      ## Inputs
      ## Workflow
      ## Output Contract
      ## Common Failure Modes

  This struct is the parsed form. Persistence is filesystem-only — no Ecto schema.
  """

  @enforce_keys [:name, :description, :path, :content]
  defstruct [
    :name,
    :description,
    :path,
    :content,
    :slug,
    triggers: [],
    valid?: true,
    errors: []
  ]

  @type t :: %__MODULE__{
          name: String.t(),
          description: String.t(),
          path: String.t(),
          content: String.t(),
          slug: String.t() | nil,
          triggers: [String.t()],
          valid?: boolean(),
          errors: [String.t()]
        }

  @required_headings [
    "# Goal",
    "## Inputs",
    "## Workflow",
    "## Output Contract",
    "## Common Failure Modes"
  ]

  @doc "List of headings every SKILL.md must contain."
  def required_headings, do: @required_headings

  @doc """
  Validate a parsed skill against the contract. Returns the skill with
  `:valid?` and `:errors` set; never raises.
  """
  def validate(%__MODULE__{} = skill) do
    errors =
      []
      |> check_name(skill)
      |> check_description(skill)
      |> check_combined_length(skill)
      |> check_headings(skill)

    %{skill | valid?: errors == [], errors: errors}
  end

  defp check_name(errors, %{name: name}) when is_binary(name) and byte_size(name) > 0,
    do: errors

  defp check_name(errors, _), do: ["missing name in frontmatter" | errors]

  defp check_description(errors, %{description: d}) when is_binary(d) and byte_size(d) > 0,
    do: errors

  defp check_description(errors, _), do: ["missing description in frontmatter" | errors]

  defp check_combined_length(errors, %{name: name, description: desc})
       when is_binary(name) and is_binary(desc) do
    if byte_size(name) + byte_size(desc) > 250 do
      ["name + description exceeds 250 chars" | errors]
    else
      errors
    end
  end

  defp check_combined_length(errors, _), do: errors

  defp check_headings(errors, %{content: content}) when is_binary(content) do
    missing =
      Enum.reject(@required_headings, fn heading ->
        String.contains?(content, heading <> "\n") or String.ends_with?(content, heading)
      end)

    case missing do
      [] -> errors
      list -> ["missing required headings: " <> Enum.join(list, ", ") | errors]
    end
  end

  defp check_headings(errors, _), do: errors
end
