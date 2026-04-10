defmodule Ema.Context.Security do
  @moduledoc """
  Context-security helpers for packet assembly and prompt injection.
  """

  alias Ema.Context.SourceItem

  @levels [:public, :internal, :private, :secret]
  @rank %{public: 0, internal: 1, private: 2, secret: 3}

  def sensitivity_levels, do: @levels
  def normalize(level) when is_atom(level) and level in @levels, do: level
  def normalize(level) when is_binary(level), do: level |> String.to_atom() |> normalize()
  def normalize(_), do: :internal

  def allowed?(%SourceItem{} = item, opts \\ []) do
    ceiling = opts |> Keyword.get(:sensitivity_ceiling, :internal) |> normalize()
    actor_type = opts |> Keyword.get(:actor_type)
    surface = opts |> Keyword.get(:surface)
    item_level = normalize(item.sensitivity)

    within_ceiling?(item_level, ceiling) and
      allowed_actor?(item.allowed_actor_types, actor_type) and
      allowed_surface?(item.allowed_surfaces, surface)
  end

  def filter_items(items, opts \\ []), do: Enum.filter(items, &allowed?(&1, opts))
  def drop_secrets_for_prompt(items), do: Enum.reject(items, &match?(%SourceItem{sensitivity: s} when s in [:secret, "secret"], &1))

  defp within_ceiling?(level, ceiling), do: Map.get(@rank, level, 99) <= Map.get(@rank, ceiling, 0)
  defp allowed_actor?(nil, _), do: true
  defp allowed_actor?([], _), do: true
  defp allowed_actor?(list, actor_type), do: actor_type in list
  defp allowed_surface?(nil, _), do: true
  defp allowed_surface?([], _), do: true
  defp allowed_surface?(list, surface), do: surface in list
end
