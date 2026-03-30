defmodule Ema.ProposalEngine.Tagger do
  @moduledoc """
  Auto-assigns tags to proposals based on content analysis via Claude (haiku for speed).
  Final stage of the pipeline -- after tagging, the proposal enters the queue.
  """

  use GenServer

  require Logger

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def tag(proposal) do
    GenServer.cast(__MODULE__, {:tag, proposal})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    {:ok, %{}}
  end

  @impl true
  def handle_cast({:tag, proposal}, state) do
    Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
      do_tag(proposal)
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp do_tag(proposal) do
    prompt = """
    Analyze this proposal and assign categorized tags.

    Title: #{proposal.title}
    Summary: #{proposal.summary}
    Body: #{String.slice(proposal.body || "", 0..500)}

    Output valid JSON with a "tags" array, each element: {"category": "domain"|"type"|"custom", "label": "tag-name"}.
    Assign 2-5 tags. Domain tags describe the area (e.g., "ui", "backend", "infra").
    Type tags describe the nature (e.g., "enhancement", "new-feature", "refactor", "experiment").
    """

    case Ema.Claude.Runner.run(prompt, model: "haiku") do
      {:ok, %{"tags" => tags}} when is_list(tags) ->
        Enum.each(tags, fn tag_data ->
          attrs = %{
            category: tag_data["category"] || "custom",
            label: tag_data["label"] || "untagged"
          }

          case Ema.Proposals.add_tag(proposal.id, attrs) do
            {:ok, _} -> :ok
            {:error, reason} -> Logger.warning("Tagger: failed to add tag: #{inspect(reason)}")
          end
        end)

        Logger.info("Tagger: tagged proposal #{proposal.id} with #{length(tags)} tags")

      {:ok, _result} ->
        Logger.warning("Tagger: unexpected response format for proposal #{proposal.id}")

      {:error, reason} ->
        Logger.warning("Tagger: Claude CLI failed for proposal #{proposal.id}: #{inspect(reason)}")
    end
  end
end
