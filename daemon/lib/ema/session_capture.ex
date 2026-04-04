defmodule Ema.SessionCapture do
  @moduledoc """
  Captures completed execution sessions as markdown files in the vault.

  Subscribes to the `"executions"` PubSub topic and writes a markdown
  session log to `{vault}/Sessions/EMA/{date}-{slug}.md` whenever an
  execution completes.
  """

  use GenServer
  require Logger

  # ── Client API ──────────────────────────────────────────────────────────────

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Synchronously captures a session log for the given execution.
  Useful for testing without going through PubSub.
  """
  def capture_sync(execution) do
    capture(execution, nil)
  end

  # ── GenServer callbacks ─────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "executions")
    {:ok, %{}}
  end

  @impl true
  def handle_info({"execution:completed", %{execution: execution, signal: signal}}, state) do
    capture(execution, signal)
    {:noreply, state}
  end

  def handle_info({"execution:" <> _event, _payload}, state) do
    {:noreply, state}
  end

  def handle_info(_msg, state) do
    {:noreply, state}
  end

  # ── Private ─────────────────────────────────────────────────────────────────

  defp capture(execution, signal) do
    filename = build_filename(execution)
    dir = Path.join([Ema.Config.vault_path(), "Sessions", "EMA"])
    path = Path.join(dir, filename)

    File.mkdir_p!(dir)

    content = build_markdown(execution, signal)

    case File.write(path, content) do
      :ok ->
        Logger.info("[SessionCapture] Wrote #{path}")

      {:error, reason} ->
        Logger.error("[SessionCapture] Failed to write #{path}: #{inspect(reason)}")
    end
  end

  defp build_filename(execution) do
    date = Date.utc_today() |> Date.to_iso8601()
    slug = execution.intent_slug || slugify(execution.title)
    "#{date}-#{slug}.md"
  end

  defp slugify(nil), do: "untitled"

  defp slugify(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
  end

  defp build_markdown(execution, signal) do
    agent = execution.agent_session_id || "unknown"
    date = Date.utc_today() |> Date.to_iso8601()
    summary = execution.objective || ""
    outcome = execution.status

    """
    # #{execution.title}

    **Date:** #{date}
    **Agent:** #{agent}
    **Outcome:** #{outcome}
    **Signal:** #{signal || "none"}

    ## Summary

    #{summary}

    ## Lessons

    Auto-captured by SessionCapture.
    """
  end
end
