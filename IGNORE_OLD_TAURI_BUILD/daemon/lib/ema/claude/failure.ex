defmodule Ema.Claude.Failure do
  @moduledoc """
  Normalized failure contract for all Claude-related operations.

  Every error path — CLI unavailable, parse failures, timeouts, auth issues —
  gets normalized into this struct before recording or surfacing. This is the
  single boundary between raw errors and the rest of the system.
  """

  alias Ema.Repo

  require Logger

  @type failure_class ::
          :auth_failure
          | :cli_unavailable
          | :backend_unavailable
          | :command_build_failure
          | :session_discovery_failure
          | :session_parse_partial
          | :session_parse_fatal
          | :project_link_failure
          | :invalid_ai_output
          | :stage_timeout
          | :persistence_failure
          | :config_failure
          | :unknown_failure

  @type domain ::
          :session_ingestion
          | :proposal_generation
          | :bridge_runtime
          | :persistence

  @type operation ::
          :discover
          | :parse
          | :link
          | :preflight
          | :dispatch
          | :stage_run
          | :persist
          | :quality_gate

  @enforce_keys [:class, :code, :domain, :component, :operation]
  defstruct [
    :class,
    :code,
    :domain,
    :component,
    :operation,
    :stage,
    :fingerprint,
    :raw_reason,
    retryable: false,
    metadata: %{}
  ]

  @type t :: %__MODULE__{
          class: failure_class(),
          code: atom(),
          domain: domain(),
          component: module(),
          operation: operation(),
          stage: atom() | nil,
          retryable: boolean(),
          fingerprint: String.t() | nil,
          raw_reason: String.t() | nil,
          metadata: map()
        }

  @max_raw_reason_length 2000

  # -------------------------------------------------------------------
  # Construction
  # -------------------------------------------------------------------

  @doc """
  Build a Failure struct from keyword opts. Computes fingerprint automatically.
  """
  @spec new(keyword()) :: t()
  def new(attrs) when is_list(attrs) do
    failure = struct!(__MODULE__, attrs)

    %{
      failure
      | fingerprint: compute_fingerprint(failure),
        raw_reason: truncate(failure.raw_reason)
    }
  end

  # -------------------------------------------------------------------
  # Classification helpers — turn raw errors into Failure structs
  # -------------------------------------------------------------------

  @doc """
  Classify a Runner error tuple into a Failure.
  """
  @spec classify_runner_error(term(), keyword()) :: t()
  def classify_runner_error(reason, opts \\ []) do
    stage = Keyword.get(opts, :stage)
    base = [domain: :bridge_runtime, component: Ema.Claude.Runner, stage: stage]

    case reason do
      %{code: :not_found} ->
        new(
          base ++
            [
              class: :cli_unavailable,
              code: :claude_binary_missing,
              operation: :preflight,
              retryable: false,
              raw_reason: inspect(reason)
            ]
        )

      %{code: :timeout} ->
        new(
          base ++
            [
              class: :stage_timeout,
              code: :cli_timeout,
              operation: :stage_run,
              retryable: true,
              raw_reason: inspect(reason)
            ]
        )

      %{code: code, message: msg} when is_integer(code) ->
        new(
          base ++
            [
              class: :backend_unavailable,
              code: :cli_nonzero_exit,
              operation: :dispatch,
              retryable: code in [1, 137],
              raw_reason: truncate(msg),
              metadata: %{exit_code: code}
            ]
        )

      other ->
        new(
          base ++
            [
              class: :unknown_failure,
              code: :unclassified_runner_error,
              operation: :dispatch,
              retryable: false,
              raw_reason: inspect(other)
            ]
        )
    end
  end

  @doc """
  Classify a session parser error into a Failure.
  """
  @spec classify_session_error(term(), keyword()) :: t()
  def classify_session_error(reason, opts \\ []) do
    base = [domain: :session_ingestion, component: Ema.ClaudeSessions.SessionParser]

    case reason do
      {:file_read_failed, posix} ->
        new(
          base ++
            [
              class: :session_discovery_failure,
              code: :session_file_unreadable,
              operation: :discover,
              retryable: true,
              raw_reason: inspect(posix),
              metadata: Keyword.get(opts, :metadata, %{})
            ]
        )

      :empty_session ->
        new(
          base ++
            [
              class: :session_parse_partial,
              code: :empty_session_file,
              operation: :parse,
              retryable: false,
              raw_reason: "JSONL file contained no parseable lines"
            ]
        )

      _ ->
        new(
          base ++
            [
              class: :session_parse_fatal,
              code: :session_parse_unknown,
              operation: :parse,
              retryable: false,
              raw_reason: inspect(reason)
            ]
        )
    end
  end

  @doc """
  Classify a proposal generation error into a Failure.
  """
  @spec classify_generation_error(term(), keyword()) :: t()
  def classify_generation_error(reason, opts \\ []) do
    seed_id = Keyword.get(opts, :seed_id)

    base = [
      domain: :proposal_generation,
      component: Ema.ProposalEngine.Generator,
      stage: :generator
    ]

    failure =
      case reason do
        %{code: :timeout} ->
          new(
            base ++
              [
                class: :stage_timeout,
                code: :generator_timeout,
                operation: :stage_run,
                retryable: true,
                raw_reason: inspect(reason)
              ]
          )

        %{code: :not_found} ->
          new(
            base ++
              [
                class: :cli_unavailable,
                code: :claude_binary_missing,
                operation: :preflight,
                retryable: false,
                raw_reason: inspect(reason)
              ]
          )

        _ ->
          new(
            base ++
              [
                class: :unknown_failure,
                code: :generator_dispatch_failed,
                operation: :dispatch,
                retryable: false,
                raw_reason: inspect(reason)
              ]
          )
      end

    if seed_id,
      do: %{failure | metadata: Map.put(failure.metadata, :seed_id, seed_id)},
      else: failure
  end

  @doc """
  Classify a persistence error (Ecto changeset failure, etc.).
  """
  @spec classify_persistence_error(term(), keyword()) :: t()
  def classify_persistence_error(reason, opts \\ []) do
    component = Keyword.get(opts, :component, __MODULE__)

    new(
      class: :persistence_failure,
      code: :ecto_insert_failed,
      domain: :persistence,
      component: component,
      operation: :persist,
      retryable: false,
      raw_reason: inspect(reason)
    )
  end

  # -------------------------------------------------------------------
  # Recording — append to failure event store
  # -------------------------------------------------------------------

  @doc """
  Record a failure to the append-only event store.
  Deduplicates by fingerprint within a 60-second window.
  """
  @spec record(t(), keyword()) :: {:ok, map()} | {:error, term()}
  def record(%__MODULE__{} = failure, opts \\ []) do
    artifact_id = Keyword.get(opts, :artifact_id)
    artifact_type = Keyword.get(opts, :artifact_type)

    if deduplicated?(failure) do
      Logger.debug("[Failure] Suppressed duplicate: #{failure.fingerprint}")
      {:ok, :deduplicated}
    else
      attrs = %{
        class: Atom.to_string(failure.class),
        code: Atom.to_string(failure.code),
        domain: Atom.to_string(failure.domain),
        component: inspect(failure.component),
        operation: Atom.to_string(failure.operation),
        stage: if(failure.stage, do: Atom.to_string(failure.stage)),
        retryable: failure.retryable,
        fingerprint: failure.fingerprint,
        raw_reason: failure.raw_reason,
        metadata: failure.metadata,
        artifact_id: artifact_id,
        artifact_type: if(artifact_type, do: Atom.to_string(artifact_type)),
        recorded_at: DateTime.utc_now()
      }

      case Repo.insert_all("claude_failure_events", [attrs]) do
        {1, _} ->
          Logger.warning(
            "[Failure] Recorded #{failure.class}/#{failure.code} from #{inspect(failure.component)}"
          )

          {:ok, attrs}

        other ->
          Logger.error("[Failure] Failed to record failure event: #{inspect(other)}")
          {:error, :insert_failed}
      end
    end
  rescue
    e ->
      # Recording failures must never crash the caller
      Logger.error("[Failure] Exception recording failure: #{Exception.message(e)}")
      {:error, :recording_exception}
  end

  # -------------------------------------------------------------------
  # Querying
  # -------------------------------------------------------------------

  @doc """
  Count failures matching the given class within a time window.
  """
  @spec count_recent(failure_class(), pos_integer()) :: non_neg_integer()
  def count_recent(class, window_seconds \\ 300) do
    import Ecto.Query

    cutoff = DateTime.add(DateTime.utc_now(), -window_seconds, :second)

    Repo.one(
      from("claude_failure_events",
        where: [class: ^Atom.to_string(class)],
        where: ^dynamic([e], e.recorded_at >= ^cutoff),
        select: count()
      )
    ) || 0
  rescue
    _ -> 0
  end

  # -------------------------------------------------------------------
  # Internals
  # -------------------------------------------------------------------

  defp compute_fingerprint(%__MODULE__{} = f) do
    data = "#{f.class}:#{f.code}:#{f.domain}:#{f.component}:#{f.operation}:#{f.stage}"
    :crypto.hash(:sha256, data) |> Base.encode16(case: :lower) |> binary_part(0, 16)
  end

  defp truncate(nil), do: nil
  defp truncate(s) when is_binary(s), do: String.slice(s, 0, @max_raw_reason_length)
  defp truncate(term), do: term |> inspect() |> truncate()

  defp deduplicated?(%__MODULE__{fingerprint: fp}) when is_binary(fp) do
    import Ecto.Query

    cutoff = DateTime.add(DateTime.utc_now(), -60, :second)

    count =
      Repo.one(
        from("claude_failure_events",
          where: [fingerprint: ^fp],
          where: ^dynamic([e], e.recorded_at >= ^cutoff),
          select: count()
        )
      )

    (count || 0) > 0
  rescue
    # If the table doesn't exist yet (pre-migration), don't block
    _ -> false
  end

  defp deduplicated?(_), do: false
end
