defmodule Ema.Pipes.Actions.ClaudeAction do
  @moduledoc """
  Pipes Action: Claude AI Transform.

  A Pipes action type that triggers the full Intelligence Layer pipeline:
    1. Wraps the pipe payload as an event
    2. Routes through Intelligence.Router (classifies + enriches context)
    3. Executes via Claude.Bridge (one-shot, non-streaming by default)
    4. Returns the Claude output for the next pipe action

  ## Config Keys

    - `prompt_template`  — string with {{variable}} placeholders from payload
    - `event_keys`       — list of context keys to inject (see ContextInjector)
    - `model`            — model override (default: SmartRouter picks)
    - `event_type`       — how to classify this action for routing (default: :general)
    - `streaming`        — whether to stream events via PubSub (default: false)
    - `timeout_ms`       — max wait for Claude response (default: 120_000)

  ## Example Pipe Config

      %{
        action_id: "claude:run",
        config: %{
          "prompt_template" => "Summarize this task: {{title}}",
          "event_keys" => ["goals", "tasks"],
          "model" => "haiku",
          "event_type" => "task_completed"
        }
      }

  ## Return Value

  Returns `{:ok, %{output: text, model: ..., tokens: ...}}` on success,
  or `{:error, reason}` on failure. The output is merged into the pipe payload
  for the next action.
  """

  require Logger

  alias Ema.Intelligence.Router
  alias Ema.Claude.Bridge

  @default_timeout_ms 120_000
  # let SmartRouter decide
  @default_model nil

  @doc """
  Execute a Claude action within a pipe.

  Takes the pipe payload + action config, builds an event, routes it through
  the Intelligence Layer, then calls Bridge.run/2.
  """
  def execute(payload, config) do
    config = normalize_config(config)

    with {:ok, prompt} <- build_prompt(payload, config),
         event = build_event(payload, config),
         routing_decision = Router.route(event),
         {:ok, enriched_context} <- extract_context(routing_decision),
         {:ok, result} <- call_bridge(prompt, enriched_context, config) do
      output_payload =
        Map.merge(payload, %{
          "claude_output" => result.text,
          "claude_model" => result.model,
          "claude_tokens" => result.output_tokens,
          "claude_cost" => result.cost
        })

      {:ok, output_payload}
    else
      {:error, reason} ->
        Logger.error("[ClaudeAction] Pipeline failed: #{inspect(reason)}")
        {:error, reason}

      other ->
        Logger.error("[ClaudeAction] Unexpected result: #{inspect(other)}")
        {:error, {:unexpected, other}}
    end
  end

  @doc """
  Execute a Claude action asynchronously within a pipe.

  Same as `execute/2` but returns `{:ok, task_id}` immediately.
  The callback (if provided) receives `{:ok, output_payload}` or `{:error, reason}`
  when Claude responds. Also broadcasts on `"claude:task:<task_id>"` PubSub topic.

  ## W7-BRIDGE-FINISH
  Added alongside the sync `execute/2` — non-breaking. Use when the pipe chain
  does not need Claude's output to continue (e.g. fire-and-forget enrichments).
  """
  def execute_async(payload, config, callback_or_pid \\ nil) do
    config = normalize_config(config)

    with {:ok, prompt} <- build_prompt(payload, config),
         event = build_event(payload, config),
         routing_decision = Router.route(event),
         {:ok, enriched_context} <- extract_context(routing_decision) do
      context_preamble = format_context_preamble(enriched_context)

      full_prompt =
        if map_size(enriched_context) > 0, do: context_preamble <> "\n\n" <> prompt, else: prompt

      bridge_opts =
        [timeout: config.timeout_ms]
        |> maybe_add_model(config.model)

      Bridge.run_async(full_prompt, bridge_opts, fn result ->
        output =
          case result do
            {:ok, r} when is_map(r) ->
              {:ok,
               Map.merge(payload, %{
                 "claude_output" => r.text,
                 "claude_model" => r.model,
                 "claude_tokens" => r.output_tokens,
                 "claude_cost" => r.cost
               })}

            {:ok, text} when is_binary(text) ->
              {:ok,
               Map.merge(payload, %{
                 "claude_output" => text,
                 "claude_model" => "unknown",
                 "claude_tokens" => 0,
                 "claude_cost" => nil
               })}

            {:error, reason} ->
              Logger.error("[ClaudeAction] Async pipeline failed: #{inspect(reason)}")
              {:error, reason}
          end

        case callback_or_pid do
          nil -> :ok
          f when is_function(f, 1) -> f.(output)
          pid when is_pid(pid) -> send(pid, {:claude_action_result, output})
        end
      end)
    else
      {:error, reason} ->
        Logger.error("[ClaudeAction] Async pre-flight failed: #{inspect(reason)}")
        {:error, reason}

      other ->
        Logger.error("[ClaudeAction] Async unexpected result: #{inspect(other)}")
        {:error, {:unexpected, other}}
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp normalize_config(config) when is_map(config) do
    %{
      prompt_template:
        config["prompt_template"] || config[:prompt_template] || "Process this event.",
      event_keys: parse_event_keys(config["event_keys"] || config[:event_keys] || []),
      model: config["model"] || config[:model] || @default_model,
      event_type: parse_event_type(config["event_type"] || config[:event_type] || "general"),
      timeout_ms: config["timeout_ms"] || config[:timeout_ms] || @default_timeout_ms
    }
  end

  defp parse_event_keys(keys) when is_list(keys) do
    Enum.map(keys, fn
      k when is_atom(k) -> k
      k when is_binary(k) -> String.to_existing_atom(k)
    end)
  rescue
    _ -> []
  end

  defp parse_event_keys(_), do: []

  defp parse_event_type(type) when is_atom(type), do: type

  defp parse_event_type(type) when is_binary(type) do
    String.to_existing_atom(type)
  rescue
    _ -> :general
  end

  defp build_prompt(payload, %{prompt_template: template}) do
    rendered =
      Regex.replace(~r/\{\{(\w+)\}\}/, template, fn _, key ->
        val = payload[key] || payload[String.to_atom(key)]
        to_string(val || "")
      end)

    {:ok, rendered}
  rescue
    e -> {:error, {:prompt_render_failed, Exception.message(e)}}
  end

  defp build_event(payload, %{event_type: event_type}) do
    %{
      type: event_type,
      data: payload,
      project_id: payload["project_id"] || payload[:project_id],
      source: :pipe
    }
  end

  defp extract_context({:hub, _target, enriched_event}) do
    {:ok, Map.get(enriched_event, :context, %{})}
  end

  defp extract_context({:domain, _agent, enriched_event}) do
    {:ok, Map.get(enriched_event, :context, %{})}
  end

  defp extract_context({:error, reason}), do: {:error, reason}

  defp call_bridge(prompt, context, config) do
    # Build a context-enriched prompt preamble
    context_preamble = format_context_preamble(context)
    full_prompt = if map_size(context) > 0, do: context_preamble <> "\n\n" <> prompt, else: prompt

    bridge_opts =
      [timeout: config.timeout_ms]
      |> maybe_add_model(config.model)

    case Bridge.run(full_prompt, bridge_opts) do
      {:ok, result} when is_map(result) ->
        {:ok, result}

      {:ok, text} when is_binary(text) ->
        # Backward compat with older Bridge API
        {:ok, %{text: text, model: "unknown", output_tokens: 0, cost: nil}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp format_context_preamble(context) when map_size(context) == 0, do: ""

  defp format_context_preamble(context) do
    sections =
      context
      |> Enum.map(fn {key, value} ->
        "## Context: #{format_key(key)}\n#{Jason.encode!(value, pretty: true)}"
      end)
      |> Enum.join("\n\n")

    "# Live Context\n\n#{sections}"
  rescue
    _ -> ""
  end

  defp format_key(key),
    do: key |> Atom.to_string() |> String.replace("_", " ") |> String.capitalize()

  defp maybe_add_model(opts, nil), do: opts
  defp maybe_add_model(opts, model), do: Keyword.put(opts, :model, model)
end
