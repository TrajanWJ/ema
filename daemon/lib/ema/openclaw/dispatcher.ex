defmodule Ema.OpenClaw.Dispatcher do
  @moduledoc """
  Routes EMA executions to OpenClaw agents based on task mode.
  Called by Ema.Executions.Dispatcher when OpenClaw is connected.
  Falls back gracefully when unavailable.
  """

  alias Ema.OpenClaw.Client
  require Logger

  @agent_map %{
    "research"  => "researcher",
    "review"    => "main",
    "implement" => "coder",
    "outline"   => "main",
    "refactor"  => "coder",
    "harvest"   => "researcher"
  }

  @doc """
  Dispatch an execution to the appropriate OpenClaw agent.
  Returns {:ok, result_text} or {:error, :openclaw_unavailable | reason}.
  """
  def dispatch(execution, opts \\ []) do
    agent_id = select_agent(execution)
    prompt = build_prompt(execution)
    timeout = Keyword.get(opts, :timeout, 300_000)

    Logger.info("[OC.Dispatcher] #{execution.id} (#{execution.mode}) → agent:#{agent_id}")

    case Client.chat(agent_id, prompt, timeout: timeout) do
      {:ok, %{text: text, usage: usage}} ->
        Logger.info("[OC.Dispatcher] #{execution.id} done. tokens=#{inspect(usage)}")
        {:ok, text}

      {:error, %{status: s}} when s in [503, 502, 404] ->
        {:error, :openclaw_unavailable}

      {:error, %Req.TransportError{}} ->
        {:error, :openclaw_unavailable}

      {:error, reason} ->
        Logger.warning("[OC.Dispatcher] #{execution.id} failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp select_agent(execution) do
    meta_agent = get_in(execution, [Access.key(:metadata, %{}), "openclaw_agent"])
    meta_agent || Map.get(@agent_map, execution.mode, "main")
  end

  defp build_prompt(execution) do
    parts = [
      "## EMA Execution Request",
      "",
      "**Execution ID:** #{execution.id}",
      "**Mode:** #{execution.mode}",
      "**Title:** #{execution.title}",
      "",
      "### Objective",
      execution.objective || execution.title
    ]

    parts =
      if execution.success_criteria && execution.success_criteria != "" do
        parts ++ ["", "### Success Criteria", execution.success_criteria]
      else
        parts
      end

    parts =
      if execution.context && execution.context != "" do
        parts ++ ["", "### Context", execution.context]
      else
        parts
      end

    parts =
      if execution.constraints && execution.constraints != "" do
        parts ++ ["", "### Constraints", execution.constraints]
      else
        parts
      end

    parts
    |> Enum.join("\n")
    |> String.trim()
  end
end
