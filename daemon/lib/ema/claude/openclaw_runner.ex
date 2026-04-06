defmodule Ema.Claude.OpenClawRunner do
  @moduledoc """
  Thin runner for sending one-shot requests to the local OpenClaw gateway.
  """

  @agent_map %{
    research: "researcher",
    summarization: "researcher",
    creative: "main",
    code_review: "main",
    general: "main",
    code_generation: "coder"
  }

  def run(prompt, opts \\ []) when is_binary(prompt) do
    task_type = Keyword.get(opts, :task_type, :general)
    timeout = Keyword.get(opts, :timeout, 300_000)
    agent_id = Keyword.get(opts, :openclaw_agent) || Map.get(@agent_map, task_type, "main")

    case Ema.OpenClaw.Client.chat(agent_id, prompt, timeout: timeout) do
      {:ok, %{text: text, usage: usage, agent_id: resolved_agent}} ->
        {:ok,
         %{
           "result" => text,
           "usage" => usage,
           "agent_id" => resolved_agent
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
