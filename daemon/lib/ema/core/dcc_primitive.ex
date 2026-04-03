defmodule Ema.Core.DccPrimitive do
  @moduledoc """
  Distilled Context Container — canonical struct for session continuity.
  Captures the essential state of a work session for persistence and resumption.
  """

  @derive Jason.Encoder

  defstruct [
    :session_id,
    :crystallized_at,
    :project_id,
    active_task_ids: [],
    decision_hashes: [],
    intent_snapshot: %{},
    proposal_context: %{},
    session_narrative: nil,
    metadata: %{}
  ]

  @type t :: %__MODULE__{
          session_id: String.t(),
          crystallized_at: DateTime.t() | nil,
          project_id: String.t() | nil,
          active_task_ids: [String.t()],
          decision_hashes: [String.t()],
          intent_snapshot: map(),
          proposal_context: map(),
          session_narrative: String.t() | nil,
          metadata: map()
        }

  @doc "Create a new DCC with generated session_id."
  def new(attrs \\ %{}) do
    id =
      "dcc_#{System.system_time(:second)}_#{:crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)}"

    %__MODULE__{session_id: id}
    |> struct(Map.delete(attrs, :session_id))
    |> Map.put(:session_id, attrs[:session_id] || id)
  end

  @doc "Mark the DCC as crystallized with current timestamp."
  def crystallize(%__MODULE__{} = dcc) do
    %{dcc | crystallized_at: DateTime.utc_now()}
  end

  @doc "Set active task IDs."
  def with_tasks(%__MODULE__{} = dcc, task_ids) when is_list(task_ids) do
    %{dcc | active_task_ids: task_ids}
  end

  @doc "Set intent snapshot."
  def with_intent_snapshot(%__MODULE__{} = dcc, snapshot) when is_map(snapshot) do
    %{dcc | intent_snapshot: snapshot}
  end

  @doc "Set session narrative."
  def with_narrative(%__MODULE__{} = dcc, narrative) when is_binary(narrative) do
    %{dcc | session_narrative: narrative}
  end

  @doc "Serialize to a plain map (for JSON/DB storage)."
  def to_map(%__MODULE__{} = dcc) do
    dcc
    |> Map.from_struct()
    |> Map.update(:crystallized_at, nil, fn
      nil -> nil
      %DateTime{} = dt -> DateTime.to_iso8601(dt)
    end)
  end

  @doc "Deserialize from a plain map (handles string keys from JSON)."
  def from_map(map) when is_map(map) do
    atomized =
      map
      |> Enum.map(fn
        {k, v} when is_binary(k) -> {String.to_existing_atom(k), v}
        {k, v} when is_atom(k) -> {k, v}
      end)
      |> Map.new()

    crystallized_at =
      case atomized[:crystallized_at] do
        nil ->
          nil

        %DateTime{} = dt ->
          dt

        iso when is_binary(iso) ->
          case DateTime.from_iso8601(iso) do
            {:ok, dt, _} -> dt
            _ -> nil
          end
      end

    %__MODULE__{
      session_id: atomized[:session_id],
      crystallized_at: crystallized_at,
      project_id: atomized[:project_id],
      active_task_ids: atomized[:active_task_ids] || [],
      decision_hashes: atomized[:decision_hashes] || [],
      intent_snapshot: atomized[:intent_snapshot] || %{},
      proposal_context: atomized[:proposal_context] || %{},
      session_narrative: atomized[:session_narrative],
      metadata: atomized[:metadata] || %{}
    }
  end
end
