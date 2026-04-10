defmodule Ema.Intents.Schematic.ModificationToggle do
  @moduledoc """
  Per-scope toggle for whether AI may modify intents via natural language.

  State is stored in `schematic_modification_state`. Rows exist only for
  explicit overrides; absence means "inherit". Resolution walks up the
  dotted scope path until an explicit row is found. The global scope is
  represented by the empty string.

  Example: `personal.ema.execution-system` walks
  `personal.ema.execution-system` → `personal.ema` → `personal` → `""`.
  The first row encountered wins. A disabled row with an expired
  `disabled_until` is treated as enabled (and should be reaped).
  """

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Intents.Schematic.ModificationState

  @global_scope ""

  @type state :: %{
          enabled: boolean(),
          disabled_reason: String.t() | nil,
          disabled_until: DateTime.t() | nil,
          source_scope: String.t() | nil,
          explicit: boolean()
        }

  @doc """
  Check whether NL modification is allowed for `scope_path`.

  Returns `:ok` if allowed, `{:error, :disabled, reason}` if any
  ancestor (or the scope itself) has an unexpired disabled row.
  """
  @spec allowed?(String.t()) :: :ok | {:error, :disabled, String.t() | nil}
  def allowed?(scope_path \\ @global_scope) when is_binary(scope_path) do
    case effective_state(scope_path) do
      %{enabled: true} -> :ok
      %{enabled: false, disabled_reason: reason} -> {:error, :disabled, reason}
    end
  end

  @doc """
  Disable NL modification for `scope_path`.

  Options:
    * `:reason`  — human-readable string explaining why
    * `:until`   — `DateTime` after which the toggle auto-reenables
    * `:actor`   — id/slug of the actor flipping the toggle
  """
  @spec disable(String.t(), keyword()) :: {:ok, ModificationState.t()} | {:error, term()}
  def disable(scope_path \\ @global_scope, opts \\ []) when is_binary(scope_path) do
    upsert(scope_path, %{
      enabled: false,
      disabled_reason: Keyword.get(opts, :reason),
      disabled_until: Keyword.get(opts, :until),
      updated_by: Keyword.get(opts, :actor)
    })
  end

  @doc """
  Enable NL modification for `scope_path`. Clears any disabled fields.

  Options:
    * `:actor` — id/slug of the actor flipping the toggle
  """
  @spec enable(String.t(), keyword()) :: {:ok, ModificationState.t()} | {:error, term()}
  def enable(scope_path \\ @global_scope, opts \\ []) when is_binary(scope_path) do
    upsert(scope_path, %{
      enabled: true,
      disabled_reason: nil,
      disabled_until: nil,
      updated_by: Keyword.get(opts, :actor)
    })
  end

  @doc """
  Return the effective state for `scope_path` after walking ancestors.

  The result always includes `:enabled`, `:disabled_reason`,
  `:disabled_until`, `:source_scope` (the scope that supplied the
  effective state, or `nil` if it defaulted), and `:explicit`
  (`true` when an explicit row was found).
  """
  @spec state(String.t()) :: state()
  def state(scope_path \\ @global_scope) when is_binary(scope_path) do
    effective_state(scope_path)
  end

  @doc "List all explicit toggle rows."
  @spec list_states() :: [ModificationState.t()]
  def list_states do
    Repo.all(from s in ModificationState, order_by: s.scope_path)
  end

  @doc """
  Auto-reenable any disabled rows whose `disabled_until` has passed.

  Returns the count of rows updated. Designed to be called periodically
  by a supervisor or scheduler.
  """
  @spec reap_expired() :: non_neg_integer()
  def reap_expired do
    now = DateTime.utc_now()

    {count, _} =
      from(s in ModificationState,
        where: s.enabled == false and not is_nil(s.disabled_until) and s.disabled_until < ^now
      )
      |> Repo.update_all(
        set: [
          enabled: true,
          disabled_reason: nil,
          disabled_until: nil,
          updated_at: DateTime.truncate(now, :second)
        ]
      )

    count
  end

  # ── Internals ─────────────────────────────────────────────────────

  defp effective_state(scope_path) do
    scope_path
    |> ancestor_chain()
    |> Enum.find_value(&lookup_explicit/1)
    |> case do
      nil -> default_state()
      state -> state
    end
  end

  # Returns the chain from most-specific scope down to global.
  # e.g. "personal.ema.foo" → ["personal.ema.foo", "personal.ema", "personal", ""]
  defp ancestor_chain(""), do: [""]

  defp ancestor_chain(scope_path) do
    parts = String.split(scope_path, ".", trim: true)

    case parts do
      [] ->
        [""]

      _ ->
        scopes =
          parts
          |> Enum.with_index(1)
          |> Enum.map(fn {_, n} -> parts |> Enum.take(n) |> Enum.join(".") end)
          |> Enum.reverse()

        scopes ++ [""]
    end
  end

  defp lookup_explicit(scope) do
    case Repo.get_by(ModificationState, scope_path: scope) do
      nil -> nil
      %ModificationState{} = row -> materialize(row)
    end
  end

  defp materialize(%ModificationState{enabled: false, disabled_until: until} = row)
       when not is_nil(until) do
    if DateTime.compare(DateTime.utc_now(), until) == :gt do
      # Expired — treat as enabled but mark scope so caller knows.
      %{
        enabled: true,
        disabled_reason: nil,
        disabled_until: nil,
        source_scope: row.scope_path,
        explicit: true
      }
    else
      %{
        enabled: false,
        disabled_reason: row.disabled_reason,
        disabled_until: until,
        source_scope: row.scope_path,
        explicit: true
      }
    end
  end

  defp materialize(%ModificationState{} = row) do
    %{
      enabled: row.enabled,
      disabled_reason: row.disabled_reason,
      disabled_until: row.disabled_until,
      source_scope: row.scope_path,
      explicit: true
    }
  end

  defp default_state do
    %{
      enabled: true,
      disabled_reason: nil,
      disabled_until: nil,
      source_scope: nil,
      explicit: false
    }
  end

  defp upsert(scope_path, attrs) do
    base =
      case Repo.get_by(ModificationState, scope_path: scope_path) do
        nil -> %ModificationState{}
        existing -> existing
      end

    base
    |> ModificationState.changeset(Map.put(attrs, :scope_path, scope_path))
    |> Repo.insert_or_update()
  end
end
