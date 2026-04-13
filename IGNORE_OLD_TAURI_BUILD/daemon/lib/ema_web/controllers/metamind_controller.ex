defmodule EmaWeb.MetaMindController do
  use EmaWeb, :controller

  alias Ema.MetaMind.{Pipeline, PromptLibrary}

  action_fallback EmaWeb.FallbackController

  def pipeline_status(conn, _params) do
    json(conn, %{
      stages: Pipeline.stages(),
      status: "ready"
    })
  end

  def library(conn, params) do
    prompts =
      case params["q"] do
        q when is_binary(q) and q != "" ->
          PromptLibrary.search_prompts(q)

        _ ->
          case params["category"] do
            cat when is_binary(cat) and cat != "" ->
              PromptLibrary.get_best_for_category(cat, parse_int(params["limit"]) || 20)

            _ ->
              PromptLibrary.list_prompts()
          end
      end

    json(conn, %{prompts: Enum.map(prompts, &serialize_prompt/1)})
  end

  def save_prompt(conn, params) do
    attrs = %{
      name: params["name"],
      body: params["body"],
      category: params["category"],
      tags: params["tags"] || [],
      template_vars: params["template_vars"] || [],
      metadata: params["metadata"] || %{}
    }

    # Include id if provided (for upsert)
    attrs = if params["id"], do: Map.put(attrs, :id, params["id"]), else: attrs

    case PromptLibrary.save_prompt(attrs) do
      {:ok, prompt} ->
        conn
        |> put_status(:created)
        |> json(%{prompt: serialize_prompt(prompt)})

      {:error, %Ecto.Changeset{} = changeset} ->
        {:error, changeset}
    end
  end

  def delete_prompt(conn, %{"id" => id}) do
    case PromptLibrary.delete_prompt(id) do
      {:ok, _prompt} ->
        json(conn, %{ok: true})

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  # --- Serializers ---

  defp serialize_prompt(prompt) do
    %{
      id: prompt.id,
      name: prompt.name,
      body: prompt.body,
      category: prompt.category,
      tags: prompt.tags,
      version: prompt.version,
      effectiveness_score: prompt.effectiveness_score,
      usage_count: prompt.usage_count,
      success_count: prompt.success_count,
      template_vars: prompt.template_vars,
      metadata: prompt.metadata,
      parent_id: prompt.parent_id,
      created_at: prompt.inserted_at,
      updated_at: prompt.updated_at
    }
  end

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, ""} -> n
      _ -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(_), do: nil
end
