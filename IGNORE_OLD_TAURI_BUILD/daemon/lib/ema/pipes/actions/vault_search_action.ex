defmodule Ema.Pipes.Actions.VaultSearchAction do
  @moduledoc """
  Pipes Action: Vault / Second Brain Full-Text Search.

  Searches the vault via `Ema.SecondBrain.Indexer.search/2` and merges
  results into the pipe payload under `vault_results`.

  ## Config Keys

    - `query_template` — string with {{variable}} placeholders from payload
    - `limit`          — max number of results (default: 10)
    - `space`          — filter to a specific vault space (optional)

  ## Example Pipe Config

      %{
        action_id: "vault:search",
        config: %{
          "query_template" => "{{title}} {{tags}}",
          "limit" => 5,
          "space" => "projects"
        }
      }
  """

  require Logger

  @default_limit 10

  @doc "Execute vault search and merge results into payload."
  def execute(payload, config) do
    config = normalize_config(config)

    with {:ok, query} <- build_query(payload, config) do
      opts = build_opts(config)
      Logger.debug("[VaultSearchAction] Searching vault: #{inspect(query)} opts=#{inspect(opts)}")

      case Ema.SecondBrain.Indexer.search(query, opts) do
        {:ok, results} ->
          {:ok, Map.put(payload, "vault_results", results)}

        {:error, reason} ->
          Logger.warning("[VaultSearchAction] Search failed: #{inspect(reason)}")
          {:error, reason}

        results when is_list(results) ->
          # Indexer returns a plain list in some implementations
          {:ok, Map.put(payload, "vault_results", results)}
      end
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp normalize_config(config) when is_map(config) do
    %{
      query_template: config["query_template"] || config[:query_template] || "{{content}}",
      limit: config["limit"] || config[:limit] || @default_limit,
      space: config["space"] || config[:space]
    }
  end

  defp build_query(payload, %{query_template: template}) do
    rendered =
      Regex.replace(~r/\{\{(\w+)\}\}/, template, fn _, key ->
        val = payload[key] || payload[String.to_atom(key)]
        to_string(val || "")
      end)
      |> String.trim()

    if rendered == "" do
      {:error, :empty_query}
    else
      {:ok, rendered}
    end
  rescue
    e -> {:error, {:query_render_failed, Exception.message(e)}}
  end

  defp build_opts(%{limit: limit, space: space}) do
    opts = [limit: limit]
    if space, do: Keyword.put(opts, :space, space), else: opts
  end
end
