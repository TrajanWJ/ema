defmodule Place.SettingsTest do
  use Place.DataCase, async: false
  alias Place.Settings

  describe "get/1" do
    test "returns default for unset key" do
      assert Settings.get("color_mode") == "dark"
      assert Settings.get("font_size") == "14"
    end
  end

  describe "set/2 and get/1" do
    test "stores and retrieves a value" do
      assert {:ok, _} = Settings.set("color_mode", "light")
      assert Settings.get("color_mode") == "light"
    end

    test "overwrites existing value" do
      {:ok, _} = Settings.set("font_size", "16")
      {:ok, _} = Settings.set("font_size", "18")
      assert Settings.get("font_size") == "18"
    end
  end

  describe "all/0" do
    test "merges defaults with stored values" do
      {:ok, _} = Settings.set("accent_color", "blue")

      result = Settings.all()
      # Stored value overrides default
      assert result["accent_color"] == "blue"
      # Defaults still present for unset keys
      assert result["color_mode"] == "dark"
      assert result["shortcut_capture"] == "Super+Shift+C"
    end
  end
end
