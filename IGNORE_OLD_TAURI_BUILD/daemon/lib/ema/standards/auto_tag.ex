defmodule Ema.Standards.AutoTag do
  @moduledoc """
  Regex-driven auto-tagger for brain dumps. Pure function — given the
  text content, return a list of tag strings. Used by
  `Ema.BrainDump.create_item/1` so that captures like:

      ema dump "bug: auth fails on Safari"

  automatically get tagged with `["bug"]`, routed by the pipes system,
  and surfaced to the right downstream context.
  """

  @rules [
    {~r/^\s*bug\s*[:\-]/i, ["bug"]},
    {~r/^\s*fix\s*[:\-]/i, ["bug", "fix"]},
    {~r/^\s*decision\s*[:\-]/i, ["decision"]},
    {~r/^\s*contact\s*[:\-]/i, ["contact"]},
    {~r/^\s*idea\s*[:\-]/i, ["idea"]},
    {~r/^\s*todo\s*[:\-]/i, ["todo"]},
    {~r/^\s*question\s*[:\-]/i, ["question"]},
    {~r/^\s*stack\s*[:\-]/i, ["stack-decision"]},
    {~r/^\s*learn(?:ing)?\s*[:\-]/i, ["learning"]},
    {~r/^\s*gotcha\s*[:\-]/i, ["learning", "gotcha"]},
    {~r/^\s*meeting\s*[:\-]/i, ["meeting"]},
    {~r/^\s*goal\s*[:\-]/i, ["goal"]}
  ]

  @doc """
  Return tags inferred from a brain dump body. Always returns a list
  (possibly empty). Multiple rules can fire — tags are de-duplicated.
  """
  @spec tags_for(String.t() | nil) :: [String.t()]
  def tags_for(nil), do: []
  def tags_for(""), do: []

  def tags_for(text) when is_binary(text) do
    @rules
    |> Enum.flat_map(fn {regex, tags} ->
      if Regex.match?(regex, text), do: tags, else: []
    end)
    |> Enum.uniq()
  end

  @doc """
  Merge auto-detected tags into an attrs map under `:tags`. Preserves
  any tags already present and de-duplicates. Used by context modules
  to opt-in via:

      attrs = Ema.Standards.AutoTag.merge_tags(attrs, attrs[:body])
  """
  @spec merge_tags(map(), String.t() | nil) :: map()
  def merge_tags(attrs, body) when is_map(attrs) do
    existing = Map.get(attrs, :tags) || Map.get(attrs, "tags") || []
    existing = if is_list(existing), do: existing, else: []
    detected = tags_for(body)
    Map.put(attrs, :tags, Enum.uniq(existing ++ detected))
  end
end
