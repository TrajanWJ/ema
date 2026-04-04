defmodule Ema.Intelligence.VaultLearner do
  @moduledoc """
  Post-task knowledge extraction and vault write-back.

  Called async by AgentWorker after dispatch_to_domain returns.
  Uses a brief Claude prompt to extract 2-5 atomic facts from agent output,
  then writes them as a markdown note to the vault.

  Never blocks the dispatch path — all work is cast + Task.start.
  """

  use GenServer
  require Logger

  def vault_base, do: Application.get_env(:ema, :vault_path, "/home/trajan/vault")

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  def init(_opts), do: {:ok, %{queued: 0, written: 0}}

  @doc """
  Schedule async learning extraction from an agent response.
  Non-blocking — returns :ok immediately.

  opts map keys:
    :agent        — atom, e.g. :strategist
    :task_type    — atom, e.g. :analysis
    :campaign_id  — binary | nil
    :response_text — the agent's response to extract from
    :session_id   — binary (for frontmatter)
  """
  def schedule_learning(opts) when is_map(opts) do
    GenServer.cast(__MODULE__, {:extract, opts})
  end

  @doc "Write a note directly to the vault at the given relative path."
  def write_note(relative_path, content, frontmatter \\ %{}) do
    GenServer.call(__MODULE__, {:write, relative_path, content, frontmatter})
  end

  def handle_cast({:extract, opts}, state) do
    Task.start(fn -> do_extract_and_write(opts) end)
    {:noreply, %{state | queued: state.queued + 1}}
  end

  def handle_call({:write, path, content, frontmatter}, _from, state) do
    result = write_vault_note(path, content, frontmatter)
    {:reply, result, %{state | written: state.written + 1}}
  end

  # --- Private ---

  defp do_extract_and_write(%{response_text: text} = opts) when is_binary(text) and byte_size(text) > 50 do
    agent = Map.get(opts, :agent, :unknown)
    task_type = Map.get(opts, :task_type, :unknown)
    campaign_id = Map.get(opts, :campaign_id)
    session_id = Map.get(opts, :session_id, "unknown")

    with {:ok, facts} <- extract_facts(text, agent, task_type),
         path <- determine_path(agent, task_type, campaign_id),
         :ok <- write_vault_note(path, format_facts(facts), %{
           type: "agent_learning",
           agent: agent,
           task_type: task_type,
           session: session_id,
           date: Date.utc_today() |> Date.to_string(),
           auto_generated: true
         }) do
      schedule_qmd_update()
      Logger.info("[VaultLearner] Wrote #{length(facts)} facts for #{agent}/#{task_type} -> #{path}")
    else
      {:error, :extraction_empty} ->
        Logger.debug("[VaultLearner] No extractable facts for #{agent}/#{task_type}")
      {:error, reason} ->
        Logger.warning("[VaultLearner] Failed: #{inspect(reason)}")
    end
  end

  defp do_extract_and_write(_opts), do: :skip

  defp extract_facts(response_text, agent, task_type) do
    trimmed = String.slice(response_text, 0, 3000)

    prompt = """
    Extract 2-5 discrete, reusable facts from this #{agent} agent response on task "#{task_type}".
    Each fact must be a single sentence. Facts should be general knowledge, not session-specific.
    Return ONLY a JSON array of strings, no markdown. Example: ["Fact one.", "Fact two."]
    Response to analyze:
    #{trimmed}
    """

    case Ema.Claude.Bridge.run(prompt, max_tokens: 300) do
      {:ok, json_text} ->
        cleaned =
          json_text
          |> String.replace(~r/```json\s*/i, "")
          |> String.replace(~r/```\s*/, "")
          |> String.trim()
          |> then(fn s ->
            case Regex.run(~r/\[.*\]/s, s) do
              [match] -> match
              _ -> s
            end
          end)

        case Jason.decode(cleaned) do
          {:ok, facts} when is_list(facts) and length(facts) > 0 -> {:ok, facts}
          _ -> {:error, :extraction_empty}
        end

      error ->
        error
    end
  end

  defp determine_path(agent, task_type, campaign_id) when not is_nil(campaign_id) do
    "Agents/#{agent}/campaigns/#{campaign_id}/#{task_type}.md"
  end

  defp determine_path(agent, task_type, _) do
    date = Date.utc_today() |> Date.to_string()
    "Agents/#{agent}/learnings/#{date}-#{task_type}.md"
  end

  defp write_vault_note(relative_path, content, frontmatter) do
    full_path = Path.join(vault_base(), relative_path)
    File.mkdir_p!(Path.dirname(full_path))
    yaml = frontmatter |> Enum.map_join("\n", fn {k, v} -> "#{k}: #{v}" end)
    note = "---\n#{yaml}\n---\n\n#{content}\n"

    case File.write(full_path, note) do
      :ok -> :ok
      {:error, reason} ->
        Logger.error("[VaultLearner] File write failed #{full_path}: #{inspect(reason)}")
        {:error, {:write_failed, reason}}
    end
  end

  defp format_facts(facts), do: Enum.map_join(facts, "\n\n", &"- #{&1}")

  defp schedule_qmd_update do
    Task.start(fn ->
      System.cmd("flock", ["-n", "/tmp/qmd.lock", "qmd", "update"], stderr_to_stdout: true)
    end)

    :ok
  end
end
