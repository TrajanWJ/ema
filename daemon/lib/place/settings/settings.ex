defmodule Place.Settings do
  @moduledoc """
  Settings — key-value store with sensible defaults for app configuration.
  """

  alias Place.Repo
  alias Place.Settings.Setting

  @defaults %{
    "color_mode" => "dark",
    "accent_color" => "teal",
    "glass_intensity" => "0.65",
    "font_family" => "system",
    "font_size" => "14",
    "launch_on_boot" => "true",
    "start_minimized" => "false",
    "shortcut_capture" => "Super+Shift+C",
    "shortcut_toggle" => "Super+Shift+Space"
  }

  def defaults, do: @defaults

  def get(key) do
    case Repo.get(Setting, key) do
      nil -> Map.get(@defaults, key)
      setting -> setting.value
    end
  end

  def set(key, value) do
    case Repo.get(Setting, key) do
      nil ->
        %Setting{}
        |> Setting.changeset(%{key: key, value: value})
        |> Repo.insert()

      existing ->
        existing
        |> Setting.changeset(%{value: value})
        |> Repo.update()
    end
  end

  def all do
    stored =
      Setting
      |> Repo.all()
      |> Map.new(fn s -> {s.key, s.value} end)

    Map.merge(@defaults, stored)
  end
end
