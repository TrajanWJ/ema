defmodule Ema.Intelligence.SupermanContinuityHook do
  @moduledoc """
  Attaches EMA session context to Superman API calls so tool execution
  maintains continuity across sessions.

  ## Usage

      opts = SupermanContinuityHook.before_call(session_id, %{instruction: "fix auth"})
      result = SupermanClient.apply_task(opts.instruction)
      SupermanContinuityHook.after_call(session_id, result)

  The before_call enriches Superman opts with session context (recent messages,
  DCC state, active tasks). The after_call imports Superman's tool_calls back
  into the session as messages with metadata.
  """

  require Logger

  alias Ema.Claude.SessionManager
  alias Ema.Persistence.SessionStore

  @doc """
  Enrich Superman call options with current session context.
  Returns the opts map with `:session_context` added.
  """
  def before_call(session_id, superman_opts)
      when is_binary(session_id) and is_map(superman_opts) do
    context = SessionManager.build_context_summary(session_id)
    Map.put(superman_opts, :session_context, context)
  end

  def before_call(nil, superman_opts), do: superman_opts

  @doc """
  Import Superman's result back into the session as tool messages.
  Extracts tool_calls from the result and records each as a session message.

  Returns `:ok` or `{:error, reason}`.
  """
  def after_call(session_id, superman_result) when is_binary(session_id) do
    tool_calls = extract_tool_calls(superman_result)

    Enum.each(tool_calls, fn tool_call ->
      SessionManager.add_message(session_id, "tool", tool_call.description, %{
        tool_calls: %{
          name: tool_call.name,
          files: tool_call.files
        },
        metadata: %{
          source: "superman",
          tool: tool_call.name,
          files_touched: tool_call.files
        }
      })
    end)

    maybe_update_dcc(session_id, tool_calls)
    :ok
  rescue
    e ->
      Logger.warning("[SupermanContinuityHook] after_call failed: #{inspect(e)}")
      {:error, e}
  end

  def after_call(nil, _result), do: :ok

  @doc """
  Convenience wrapper that runs before_call, executes the Superman function,
  then runs after_call. Returns the Superman result.
  """
  def with_continuity(session_id, superman_opts, fun) when is_function(fun, 1) do
    enriched = before_call(session_id, superman_opts)
    result = fun.(enriched)
    after_call(session_id, result)
    result
  end

  # --- Private ---

  defp extract_tool_calls({:ok, %{"tool_calls" => calls}}) when is_list(calls) do
    Enum.map(calls, &normalize_tool_call/1)
  end

  defp extract_tool_calls({:ok, %{"changes" => changes}}) when is_list(changes) do
    Enum.map(changes, fn change ->
      %{
        name: "file_change",
        description: Map.get(change, "description", "File modified"),
        files: List.wrap(Map.get(change, "file", Map.get(change, "path")))
      }
    end)
  end

  defp extract_tool_calls({:ok, body}) when is_map(body) do
    # Try to extract any tool-like actions from generic responses
    case Map.get(body, "actions") do
      actions when is_list(actions) ->
        Enum.map(actions, &normalize_tool_call/1)

      _ ->
        []
    end
  end

  defp extract_tool_calls(_), do: []

  defp normalize_tool_call(call) when is_map(call) do
    %{
      name: Map.get(call, "name", Map.get(call, "tool", "unknown")),
      description: Map.get(call, "description", Map.get(call, "summary", "")),
      files: List.wrap(Map.get(call, "files", Map.get(call, "files_touched", [])))
    }
  end

  defp maybe_update_dcc(session_id, tool_calls) when tool_calls != [] do
    if Process.whereis(SessionStore) != nil do
      case SessionStore.fetch(session_id) do
        {:ok, dcc} ->
          files =
            tool_calls
            |> Enum.flat_map(& &1.files)
            |> Enum.uniq()

          tools = Enum.map(tool_calls, & &1.name) |> Enum.uniq()

          updated =
            %{
              dcc
              | metadata:
                  Map.merge(dcc.metadata, %{
                    "last_superman_call" => DateTime.to_iso8601(DateTime.utc_now()),
                    "superman_files_touched" => files,
                    "superman_tools_used" => tools
                  })
            }

          SessionStore.store(session_id, updated)

        :error ->
          :ok
      end
    end
  end

  defp maybe_update_dcc(_session_id, _tool_calls), do: :ok
end
