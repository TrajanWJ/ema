defmodule Ema.Intents.Schematic.Contradictions do
  @moduledoc """
  Queue management, resolution, and detection for schematic contradictions.

  A contradiction is a logical conflict between intents detected by either
  an interactive `update` pass or a scheduled audit. They sit in a queue
  with status `open`, `acknowledged`, `resolved`, or `dismissed`.

  Detection (`audit/1`) walks the intent tree under a scope, asks Claude
  to find conflicts, and inserts each as a row tagged
  `detected_by: "scheduled_audit"`.
  """

  import Ecto.Query

  require Logger

  alias Ema.Repo
  alias Ema.Intents
  alias Ema.Intents.Intent
  alias Ema.Intents.Schematic.Contradiction
  alias Ema.Intents.Schematic.Target
  alias Ema.Claude.Runner

  @severity_rank %{"critical" => 0, "high" => 1, "medium" => 2, "low" => 3}

  # ── Queries ──────────────────────────────────────────────────────

  @doc """
  List contradictions, filtered and sorted by severity (critical first)
  then most-recent.

  Options:
    * `:status` — defaults to `"open"`. Pass `:any` to disable.
    * `:scope_path` — prefix match against `scope_path`.
    * `:severity` — exact severity match.
  """
  @spec list(keyword()) :: [Contradiction.t()]
  def list(opts \\ []) do
    status = Keyword.get(opts, :status, "open")
    scope = Keyword.get(opts, :scope_path)
    severity = Keyword.get(opts, :severity)

    Contradiction
    |> filter_status(status)
    |> filter_scope(scope)
    |> filter_severity(severity)
    |> Repo.all()
    |> Enum.sort_by(&{Map.get(@severity_rank, &1.severity, 99), negate(&1.inserted_at)})
  end

  defp filter_status(query, :any), do: query
  defp filter_status(query, nil), do: query
  defp filter_status(query, status), do: where(query, [c], c.status == ^status)

  defp filter_scope(query, nil), do: query

  defp filter_scope(query, prefix) do
    pattern = prefix <> "%"
    where(query, [c], like(c.scope_path, ^pattern))
  end

  defp filter_severity(query, nil), do: query
  defp filter_severity(query, severity), do: where(query, [c], c.severity == ^severity)

  defp negate(%DateTime{} = dt), do: -DateTime.to_unix(dt, :microsecond)

  defp negate(%NaiveDateTime{} = dt) do
    -(dt |> DateTime.from_naive!("Etc/UTC") |> DateTime.to_unix(:microsecond))
  end

  defp negate(_), do: 0

  @spec get(String.t()) :: Contradiction.t() | nil
  def get(id), do: Repo.get(Contradiction, id)

  @spec get!(String.t()) :: Contradiction.t()
  def get!(id), do: Repo.get!(Contradiction, id)

  @spec create(map()) :: {:ok, Contradiction.t()} | {:error, Ecto.Changeset.t()}
  def create(attrs) do
    %Contradiction{}
    |> Contradiction.changeset(attrs)
    |> Repo.insert()
  end

  @spec count_open(String.t() | nil) :: non_neg_integer()
  def count_open(scope_path \\ nil) do
    Contradiction
    |> where([c], c.status == "open")
    |> filter_scope(scope_path)
    |> select([c], count(c.id))
    |> Repo.one()
    |> Kernel.||(0)
  end

  # ── Resolution ───────────────────────────────────────────────────

  @doc """
  Mark a contradiction `resolved`. Records `:resolution_notes` and the
  acting actor and emits a lineage event on `intent_a` if present.
  """
  @spec resolve(String.t(), String.t() | nil, String.t() | nil) ::
          {:ok, Contradiction.t()} | {:error, Ecto.Changeset.t() | :not_found}
  def resolve(id, notes, actor_id \\ nil) do
    case get(id) do
      nil ->
        {:error, :not_found}

      contradiction ->
        attrs = %{
          status: "resolved",
          resolution_notes: notes,
          resolution_actor: actor_id,
          resolved_at: now()
        }

        with {:ok, updated} <-
               contradiction
               |> Contradiction.changeset(attrs)
               |> Repo.update() do
          maybe_emit_event(updated, "contradiction_resolved", %{
            id: updated.id,
            notes: notes,
            actor: actor_id
          })

          {:ok, updated}
        end
    end
  end

  @doc """
  Mark a contradiction `dismissed`. No notes — explicit "this isn't a
  problem" call.
  """
  @spec dismiss(String.t(), String.t() | nil) ::
          {:ok, Contradiction.t()} | {:error, Ecto.Changeset.t() | :not_found}
  def dismiss(id, actor_id \\ nil) do
    case get(id) do
      nil ->
        {:error, :not_found}

      contradiction ->
        attrs = %{
          status: "dismissed",
          resolution_actor: actor_id,
          resolved_at: now()
        }

        with {:ok, updated} <-
               contradiction
               |> Contradiction.changeset(attrs)
               |> Repo.update() do
          maybe_emit_event(updated, "contradiction_dismissed", %{
            id: updated.id,
            actor: actor_id
          })

          {:ok, updated}
        end
    end
  end

  defp maybe_emit_event(%Contradiction{intent_a_id: nil}, _type, _payload), do: :ok

  defp maybe_emit_event(%Contradiction{intent_a_id: intent_id}, type, payload) do
    case Intents.emit_event(intent_id, type, payload) do
      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.debug("Contradictions: skipped lineage event #{type}: #{inspect(reason)}")
        :ok
    end
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)

  # ── Detection / Audit ────────────────────────────────────────────

  @doc """
  Detect contradictions in a given scope path. Walks the intent tree,
  asks Claude to identify logical conflicts, and inserts each finding
  as a row tagged `detected_by: "scheduled_audit"`.

  Returns `{:ok, count_inserted}` or `{:error, reason}`. Degrades
  gracefully when Claude is unavailable or returns malformed JSON.
  """
  @spec audit(String.t()) :: {:ok, non_neg_integer()} | {:error, term()}
  def audit(scope_path) when is_binary(scope_path) do
    with {:ok, target} <- Target.resolve(scope_path),
         intents when intents != [] <- Target.intents_in_scope(target),
         {:ok, findings} <- detect_contradictions(scope_path, intents) do
      inserted = persist_findings(scope_path, intents, findings)
      {:ok, inserted}
    else
      [] ->
        {:ok, 0}

      {:error, reason} ->
        Logger.warning("Contradictions.audit/1 failed for #{scope_path}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp detect_contradictions(scope_path, intents) do
    prompt = build_audit_prompt(scope_path, intents)

    case safe_runner_call(prompt) do
      {:ok, raw} -> parse_audit_response(raw)
      {:error, reason} -> {:error, reason}
    end
  end

  defp safe_runner_call(prompt) do
    try do
      case Runner.run(prompt, []) do
        {:ok, %{"result" => raw}} when is_binary(raw) -> {:ok, raw}
        {:ok, %{result: raw}} when is_binary(raw) -> {:ok, raw}
        {:ok, raw} when is_binary(raw) -> {:ok, raw}
        {:ok, other} -> {:error, {:unexpected_runner_response, other}}
        {:error, reason} -> {:error, reason}
      end
    rescue
      e ->
        Logger.warning("Contradictions: runner crashed: #{inspect(e)}")
        {:error, {:runner_crashed, e}}
    end
  end

  defp parse_audit_response(raw) when is_binary(raw) do
    json = extract_json(raw)

    case Jason.decode(json) do
      {:ok, %{"contradictions" => list}} when is_list(list) ->
        {:ok, list}

      {:ok, _other} ->
        {:ok, []}

      {:error, reason} ->
        {:error, {:invalid_json, reason}}
    end
  end

  # Some models wrap JSON in ```json fences. Strip them.
  defp extract_json(raw) do
    case Regex.run(~r/```(?:json)?\s*(\{.*\})\s*```/s, raw) do
      [_, captured] -> captured
      _ -> raw
    end
  end

  defp persist_findings(scope_path, intents, findings) do
    slug_lookup = Map.new(intents, fn i -> {i.slug, i} end)

    findings
    |> Enum.reduce(0, fn finding, acc ->
      case build_attrs(scope_path, slug_lookup, finding) do
        {:ok, attrs} ->
          case create(attrs) do
            {:ok, _} ->
              acc + 1

            {:error, cs} ->
              Logger.debug("Contradictions: insert failed: #{inspect(cs.errors)}")
              acc
          end

        :skip ->
          acc
      end
    end)
  end

  defp build_attrs(scope_path, slug_lookup, finding) when is_map(finding) do
    slugs = Map.get(finding, "intent_slugs", [])
    description = Map.get(finding, "description")
    severity = normalize_severity(Map.get(finding, "severity"))

    {a, b} = pick_intents(slugs, slug_lookup)

    cond do
      not is_binary(description) or description == "" -> :skip
      is_nil(a) -> :skip
      true ->
        {:ok,
         %{
           scope_path: scope_path,
           intent_a_id: a.id,
           intent_b_id: b && b.id,
           description: description,
           severity: severity,
           detected_by: "scheduled_audit",
           status: "open"
         }}
    end
  end

  defp build_attrs(_scope_path, _lookup, _other), do: :skip

  defp pick_intents(slugs, lookup) when is_list(slugs) do
    found =
      slugs
      |> Enum.map(&Map.get(lookup, &1))
      |> Enum.reject(&is_nil/1)

    case found do
      [] -> {nil, nil}
      [a] -> {a, nil}
      [a, b | _] -> {a, b}
    end
  end

  defp pick_intents(_, _), do: {nil, nil}

  defp normalize_severity(s) when s in ["low", "medium", "high", "critical"], do: s
  defp normalize_severity(_), do: "medium"

  defp build_audit_prompt(scope_path, intents) do
    rendered =
      intents
      |> Enum.map(fn %Intent{} = i ->
        desc = i.description || ""
        "- #{i.slug} [#{i.status}/#{Intent.level_name(i.level)}]: #{i.title}\n  #{desc}"
      end)
      |> Enum.join("\n")

    """
    You are auditing an intent tree for logical contradictions.

    ## Scope
    #{scope_path}

    ## Intents
    #{rendered}

    ## Task
    Find logical conflicts among these intents. Look for:
      - mutually exclusive goals (achieving one prevents the other)
      - contradictory descriptions or success criteria
      - circular dependencies
      - intents whose stated outcomes negate each other
      - obvious resource conflicts (same finite resource claimed by multiple)

    Be conservative — only flag genuine conflicts, not mere overlap or
    related work.

    ## Output
    Respond with **only** valid JSON, no prose, no markdown fencing,
    matching this shape exactly:

    {
      "contradictions": [
        {
          "intent_slugs": ["slug-a", "slug-b"],
          "description": "Plain-English explanation of the conflict.",
          "severity": "low" | "medium" | "high" | "critical"
        }
      ]
    }

    If there are no contradictions, return `{"contradictions": []}`.
    """
  end
end
