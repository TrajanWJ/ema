defmodule Ema.Vault.VaultBridge do
  @moduledoc """
  Automatically writes EMA decisions and execution logs back to the Obsidian vault.
  Called by the Dispatcher after key events.
  """

  require Logger
  alias Ema.Vault.VaultIndex

  # Called when a proposal is approved and dispatched
  def on_proposal_dispatched(proposal) do
    content = """
    ---
    title: "Decision: #{proposal.title}"
    date: #{Date.utc_today()}
    type: decision
    status: executed
    ema_proposal_id: #{proposal.id}
    tags: [decision, ema-sync, #{proposal.domain || "general"}]
    ---

    # #{proposal.title}

    **Dispatched:** #{DateTime.utc_now() |> DateTime.to_string()}
    **Domain:** #{proposal.domain || "_Not set_"}

    ## Proposal

    #{proposal.content || "_No content_"}

    ## Rationale

    #{proposal.rationale || "_Not captured_"}
    """

    filename = "Decisions/#{Date.utc_today()}-#{slugify(proposal.title)}.md"

    case VaultIndex.write_note(filename, content) do
      :ok ->
        Logger.info("[VaultBridge] Wrote decision note: #{filename}")
        {:ok, filename}

      {:error, reason} ->
        Logger.warning(
          "[VaultBridge] Failed to write decision note #{filename}: #{inspect(reason)}"
        )

        {:error, reason}
    end
  end

  # Called when an execution completes successfully
  def on_execution_completed(execution, git_diff) do
    content = """
    ---
    title: "Execution: #{execution.intent_slug}"
    date: #{Date.utc_today()}
    type: execution-log
    status: completed
    ema_execution_id: #{execution.id}
    tags: [execution-log, ema-sync]
    ---

    # Execution: #{execution.intent_slug}

    **Completed:** #{DateTime.utc_now() |> DateTime.to_string()}
    **Project:** #{execution.project_slug || "_Unknown_"}
    **Mode:** #{execution.mode || "_Unknown_"}

    ## What Changed

    #{if git_diff, do: "```diff\n#{String.slice(git_diff, 0, 2000)}\n```", else: "_No git diff captured_"}
    """

    filename = "Sessions/#{Date.utc_today()}-exec-#{execution.id}.md"

    case VaultIndex.write_note(filename, content) do
      :ok ->
        Logger.info("[VaultBridge] Wrote execution log: #{filename}")
        {:ok, filename}

      {:error, reason} ->
        Logger.warning(
          "[VaultBridge] Failed to write execution log #{filename}: #{inspect(reason)}"
        )

        {:error, reason}
    end
  end

  defp slugify(str) do
    str
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.slice(0, 50)
  end
end
