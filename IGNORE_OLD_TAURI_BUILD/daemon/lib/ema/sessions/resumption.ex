defmodule Ema.Sessions.Resumption do
  @moduledoc """
  Builds context-rich handoff prompts from session checkpoints.

  When a session crashes or is interrupted, `build_handoff_prompt/1` generates
  a continuation prompt that a new Claude session can pick up from, including:
  - What the original intent/objective was
  - Which files were modified
  - What the last action was
  - Git diff summary showing current state of changes
  """

  alias Ema.Sessions.Checkpoint

  @doc """
  Build a handoff prompt from a checkpoint that a new session can use to
  resume work where the previous session left off.
  """
  @spec build_handoff_prompt(%Checkpoint{}) :: String.t()
  def build_handoff_prompt(%Checkpoint{} = checkpoint) do
    sections =
      [
        build_header(checkpoint),
        build_intent_section(checkpoint),
        build_files_section(checkpoint),
        build_last_action_section(checkpoint),
        build_git_section(checkpoint),
        build_instructions()
      ]
      |> Enum.reject(&is_nil/1)

    Enum.join(sections, "\n\n")
  end

  @doc """
  Build a handoff prompt from a checkpoint ID.
  """
  @spec build_handoff_prompt_by_id(String.t()) :: {:ok, String.t()} | {:error, :not_found}
  def build_handoff_prompt_by_id(checkpoint_id) do
    case Ema.Repo.get(Checkpoint, checkpoint_id) do
      nil -> {:error, :not_found}
      checkpoint -> {:ok, build_handoff_prompt(checkpoint)}
    end
  end

  # --- Sections ---

  defp build_header(checkpoint) do
    "## Session Continuation\n\nThis is a continuation of a previous session that was interrupted.\nCheckpoint: #{checkpoint.id} (#{format_time(checkpoint.checkpoint_at)})"
  end

  defp build_intent_section(checkpoint) do
    case resolve_intent_context(checkpoint) do
      nil ->
        if checkpoint.phase do
          "### Phase\nYou were in the **#{checkpoint.phase}** phase."
        end

      context ->
        "### Intent\n#{context}"
    end
  end

  defp build_files_section(%{files_modified: files}) when is_list(files) and files != [] do
    file_list =
      files
      |> Enum.take(30)
      |> Enum.map_join("\n", &("- `#{&1}`"))

    suffix = if length(files) > 30, do: "\n- ... and #{length(files) - 30} more", else: ""

    "### Modified Files\n#{file_list}#{suffix}"
  end

  defp build_files_section(_), do: nil

  defp build_last_action_section(%{last_tool_call: nil}), do: nil
  defp build_last_action_section(%{last_tool_call: ""}), do: nil

  defp build_last_action_section(%{last_tool_call: tool_call}) do
    "### Last Action\n```\n#{tool_call}\n```"
  end

  defp build_git_section(%{git_diff_summary: nil}), do: nil
  defp build_git_section(%{git_diff_summary: ""}), do: nil

  defp build_git_section(%{git_diff_summary: diff}) do
    "### Git Status at Interruption\n```\n#{diff}\n```"
  end

  defp build_instructions do
    """
    ### Instructions
    1. Review the modified files to understand what was already done
    2. Check `git diff` for uncommitted changes
    3. Continue the work from where it was interrupted
    4. Do not redo work that is already complete\
    """
  end

  # --- Helpers ---

  defp resolve_intent_context(%{intent_id: nil, execution_id: nil, phase: phase}) do
    if phase, do: "Phase: **#{phase}**"
  end

  defp resolve_intent_context(%{execution_id: eid}) when is_binary(eid) and eid != "" do
    case Ema.Executions.get_execution(eid) do
      nil ->
        nil

      execution ->
        parts =
          [
            "**Objective:** #{execution.title}",
            if(execution.objective, do: "\n#{execution.objective}"),
            "**Mode:** #{execution.mode}",
            "**Project:** #{execution.project_slug || "unlinked"}",
            if(execution.intent_slug, do: "**Intent:** #{execution.intent_slug}")
          ]
          |> Enum.reject(&is_nil/1)

        Enum.join(parts, "\n")
    end
  end

  defp resolve_intent_context(%{intent_id: iid}) when is_binary(iid) and iid != "" do
    case Ema.Intents.get_intent(iid) do
      nil -> nil
      intent -> "**Intent:** #{intent.title || intent.slug}\n#{intent.body || ""}"
    end
  end

  defp resolve_intent_context(_), do: nil

  defp format_time(nil), do: "unknown"

  defp format_time(%DateTime{} = dt) do
    Calendar.strftime(dt, "%Y-%m-%d %H:%M:%S UTC")
  end
end
