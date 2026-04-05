defmodule Ema.Voice.CommandParser do
  @moduledoc """
  Parses transcribed text for voice commands.
  Returns {:command, command_type, args} or :conversation.

  Supported commands:
  - "open [app]" → {:command, :open_app, "app"}
  - "show me [target]" → {:command, :show, "target"}
  - "create task [text]" → {:command, :create_task, "text"}
  - "add task [text]" → {:command, :create_task, "text"}
  - "brain dump [text]" → {:command, :brain_dump, "text"}
  - "capture [text]" → {:command, :brain_dump, "text"}
  - "ask claude [question]" → {:command, :ask_claude, "question"}
  """

  @type command :: :open_app | :show | :create_task | :brain_dump | :ask_claude | :unknown
  @type result :: {:command, command(), String.t()} | :conversation

  @doc """
  Parse raw transcribed text into a command or conversation intent.
  """
  @spec parse(String.t()) :: result()
  def parse(text) when is_binary(text) do
    trimmed = String.trim(text)
    normalized = String.downcase(trimmed)

    cond do
      match_pattern(normalized, ~r/^(?:open|launch|start)\s+(.+)$/i) ->
        {:command, :open_app, normalize_app_name(match_pattern(normalized, ~r/^(?:open|launch|start)\s+(.+)$/i))}

      match_pattern(normalized, ~r/^show\s+(?:me\s+)?(.+)$/i) ->
        {:command, :show, extract_arg(trimmed, ~r/^(?:show)\s+(?:me\s+)?(.+)$/i)}

      match_pattern(normalized, ~r/^(?:create|add|new)\s+task\s+(.+)$/i) ->
        {:command, :create_task, extract_arg(trimmed, ~r/^(?:create|add|new)\s+task\s+(.+)$/i)}

      match_pattern(normalized, ~r/^(?:brain\s*dump|capture|remember|note)\s+(.+)$/i) ->
        {:command, :brain_dump, extract_arg(trimmed, ~r/^(?:brain\s*dump|capture|remember|note)\s+(.+)$/i)}

      match_pattern(normalized, ~r/^(?:ask\s+claude|hey\s+claude|claude)\s+(.+)$/i) ->
        {:command, :ask_claude, extract_arg(trimmed, ~r/^(?:ask\s+claude|hey\s+claude|claude)\s+(.+)$/i)}

      true ->
        :conversation
    end
  end

  @doc """
  Returns a list of available command patterns for display to the user.
  """
  @spec available_commands() :: [%{pattern: String.t(), description: String.t()}]
  def available_commands do
    [
      %{pattern: "open [app]", description: "Open an EMA module"},
      %{pattern: "show me [target]", description: "Navigate to a view"},
      %{pattern: "create task [text]", description: "Create a new task"},
      %{pattern: "brain dump [text]", description: "Quick capture to brain dump"},
      %{pattern: "ask claude [question]", description: "Ask Claude a question"}
    ]
  end

  # ── Internals ──

  defp match_pattern(text, regex) do
    case Regex.run(regex, text) do
      [_, capture] -> String.trim(capture)
      _ -> nil
    end
  end

  @app_aliases %{
    "tasks" => "tasks",
    "task" => "tasks",
    "to do" => "tasks",
    "todo" => "tasks",
    "brain dump" => "brain-dump",
    "braindump" => "brain-dump",
    "inbox" => "brain-dump",
    "habits" => "habits",
    "journal" => "journal",
    "diary" => "journal",
    "projects" => "projects",
    "project" => "projects",
    "settings" => "settings",
    "agents" => "agents",
    "agent" => "agents",
    "vault" => "vault",
    "knowledge" => "vault",
    "canvas" => "canvas",
    "pipes" => "pipes",
    "workflows" => "pipes",
    "proposals" => "proposals",
    "channels" => "channels",
    "dashboard" => "launchpad",
    "home" => "launchpad",
    "responsibilities" => "responsibilities"
  }

  defp normalize_app_name(raw) do
    key = String.downcase(String.trim(raw))
    Map.get(@app_aliases, key, key)
  end

  defp extract_arg(text, regex) do
    case Regex.run(regex, text) do
      [_, capture] -> String.trim(capture)
      _ -> String.trim(text)
    end
  end
end
