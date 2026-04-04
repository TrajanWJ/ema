defmodule Ema.Intelligence.ContextBuilder do
  @moduledoc """
  Assembles pre-dispatch context for agent runs from local files only.

  Queries:
  - Recent execution outcomes for the same domain/mode (from EMA outcome-tracker JSON)
  - User preferences from vault (Trajan/Preferences.md)
  - Today's daily note from vault (Daily Notes/YYYY-MM-DD.md)
  - Task-relevant vault notes via grep

  All reads degrade gracefully — missing files return empty strings/lists.
  """

  @vault_path Application.compile_env(:ema, :vault_path, Path.expand("~/.local/share/ema/vault"))
  @ema_tracker_path Application.compile_env(
                      :ema,
                      :ema_tracker_path,
                      Path.expand("~/.local/share/ema/outcome-tracker.json")
                    )

  @doc """
  Build a context map for the given execution.

  `execution` — an `%Ema.Executions.Execution{}` struct (or map with `:mode`, `:intent_slug`, `:title`)
  """
  def build_context(execution) do
    domain = execution.mode || "unknown"
    query = execution.title || execution.intent_slug || ""

    %{
      recent_outcomes: get_recent_outcomes(domain, 3),
      user_preferences: get_preferences(),
      daily_context: get_daily_note(),
      relevant_vault: search_vault(query, limit: 3)
    }
  end

  @doc """
  Prepend a context block to a prompt string.
  Returns the prompt unchanged if context has no meaningful content.
  """
  def inject_context(prompt, context) do
    block = format_context_block(context)

    if String.trim(block) == "" do
      prompt
    else
      block <> "\n\n---\n\n" <> prompt
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp get_recent_outcomes(domain, n) do
    case File.read(@ema_tracker_path) do
      {:ok, content} ->
        case Jason.decode(content) do
          {:ok, entries} when is_list(entries) ->
            entries
            |> Enum.filter(&(&1["domain"] == domain or &1["mode"] == domain))
            |> Enum.take(n)
            |> format_outcomes()

          _ ->
            ""
        end

      _ ->
        ""
    end
  end

  defp format_outcomes([]), do: ""

  defp format_outcomes(outcomes) do
    outcomes
    |> Enum.map_join("\n", fn o ->
      status = o["status"] || "unknown"
      intent = o["intent"] || o["intent_slug"] || "?"
      ts = o["timestamp"] || ""
      "- [#{status}] #{intent} #{if ts != "", do: "(#{ts})", else: ""}"
    end)
  end

  defp get_preferences do
    path = Path.join(@vault_path, "Trajan/Preferences.md")

    case File.read(path) do
      {:ok, content} ->
        content
        |> String.split("\n")
        |> Enum.take(100)
        |> Enum.join("\n")

      _ ->
        ""
    end
  end

  defp get_daily_note do
    date = Date.utc_today() |> Date.to_string()
    path = Path.join(@vault_path, "Daily Notes/#{date}.md")

    case File.read(path) do
      {:ok, content} -> String.slice(content, 0, 2000)
      _ -> ""
    end
  end

  defp search_vault(query, opts) do
    limit = Keyword.get(opts, :limit, 3)

    if String.trim(query) == "" do
      []
    else
      {output, exit_code} =
        System.cmd(
          "grep",
          ["-r", "-l", query, @vault_path, "--include=*.md"],
          stderr_to_stdout: false
        )

      if exit_code in [0, 1] do
        output
        |> String.split("\n", trim: true)
        |> Enum.take(limit)
        |> Enum.map(&read_vault_file/1)
        |> Enum.reject(&(&1 == ""))
      else
        []
      end
    end
  rescue
    _ -> []
  end

  defp read_vault_file(path) do
    case File.read(path) do
      {:ok, content} ->
        lines = content |> String.split("\n") |> Enum.take(100) |> Enum.join("\n")
        "### #{Path.basename(path, ".md")}\n#{lines}"

      _ ->
        ""
    end
  end

  defp format_context_block(context) do
    parts = [
      format_section("Recent outcomes", context.recent_outcomes),
      format_section("User preferences", context.user_preferences),
      format_section("Today's context", context.daily_context),
      format_vault_section(context.relevant_vault)
    ]

    meaningful = Enum.reject(parts, &(String.trim(&1) == ""))

    if meaningful == [] do
      ""
    else
      "## Pre-Dispatch Context\n\n" <> Enum.join(meaningful, "\n\n")
    end
  end

  defp format_section(_label, ""), do: ""
  defp format_section(_label, nil), do: ""

  defp format_section(label, content) do
    "### #{label}\n#{content}"
  end

  defp format_vault_section([]), do: ""

  defp format_vault_section(notes) do
    "### Relevant vault notes\n" <> Enum.join(notes, "\n\n")
  end
end
