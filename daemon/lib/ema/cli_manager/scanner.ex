defmodule Ema.CliManager.Scanner do
  @moduledoc """
  Auto-detects installed CLI coding agents.
  """

  alias Ema.CliManager

  @known_tools [
    %{
      name: "claude",
      binary_names: ["claude"],
      session_dir: "~/.claude/projects",
      capabilities: ~w(code chat review)
    },
    %{
      name: "codex",
      binary_names: ["codex"],
      session_dir: "~/.codex/sessions",
      capabilities: ~w(code)
    },
    %{
      name: "openclaw",
      binary_names: ["openclaw"],
      session_dir: "~/.openclaw",
      capabilities: ~w(code chat research)
    },
    %{
      name: "oauth-coder",
      binary_names: ["oauth-coder"],
      session_dir: "~/.config/oauth-cli-coder",
      capabilities: ~w(code chat orchestration)
    },
    %{
      name: "aider",
      binary_names: ["aider"],
      session_dir: nil,
      capabilities: ~w(code chat)
    },
    %{
      name: "opencode",
      binary_names: ["opencode"],
      session_dir: nil,
      capabilities: ~w(code)
    },
    %{
      name: "goose",
      binary_names: ["goose"],
      session_dir: nil,
      capabilities: ~w(code chat)
    },
    %{
      name: "openhands",
      binary_names: ["openhands"],
      session_dir: nil,
      capabilities: ~w(code)
    },
    %{
      name: "plandex",
      binary_names: ["plandex", "pdx"],
      session_dir: nil,
      capabilities: ~w(code plan)
    },
    %{
      name: "gemini-cli",
      binary_names: ["gemini"],
      session_dir: nil,
      capabilities: ~w(code chat)
    },
    %{
      name: "amp",
      binary_names: ["amp"],
      session_dir: nil,
      capabilities: ~w(code)
    }
  ]

  def scan do
    extra_paths = [
      Path.expand("~/.local/bin"),
      Path.expand("~/.cargo/bin"),
      "/usr/local/bin"
    ]

    @known_tools
    |> Enum.map(fn tool_def -> {tool_def, find_binary(tool_def.binary_names, extra_paths)} end)
    |> Enum.filter(fn {_def, path} -> path != nil end)
    |> Enum.map(fn {tool_def, path} ->
      version = detect_version(path)

      CliManager.upsert_tool(%{
        "name" => tool_def.name,
        "binary_path" => path,
        "version" => version,
        "capabilities" => Jason.encode!(tool_def.capabilities),
        "session_dir" => tool_def.session_dir && Path.expand(tool_def.session_dir),
        "detected_at" => DateTime.utc_now()
      })
    end)
    |> Enum.filter(&match?({:ok, _}, &1))
    |> Enum.map(fn {:ok, tool} -> tool end)
  end

  defp find_binary(names, extra_paths) do
    Enum.find_value(names, fn name ->
      System.find_executable(name) ||
        Enum.find_value(extra_paths, fn dir ->
          path = Path.join(dir, name)
          if File.exists?(path), do: path
        end)
    end)
  end

  defp detect_version(binary_path) do
    case System.cmd(binary_path, ["--version"], stderr_to_stdout: true) do
      {output, 0} -> output |> String.trim() |> String.slice(0, 100)
      _ -> nil
    end
  rescue
    _ -> nil
  end
end
