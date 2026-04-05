defmodule EmaWeb.PromptController do
  use EmaWeb, :controller

  alias Ema.Prompts.Store
  alias EmaWeb.PromptJSON

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    prompts =
      cond do
        truthy_param?(params["all"]) -> Store.list_prompts()
        is_binary(params["kind"]) and params["kind"] != "" -> Store.list_prompts_by_kind(params["kind"])
        true -> Store.list_latest_per_kind()
      end

    serialized = PromptJSON.prompts(prompts)
    json(conn, %{prompts: serialized, templates: serialized})
  end

  def show(conn, %{"id" => id}) do
    case Store.get_prompt(id) do
      nil ->
        {:error, :not_found}

      prompt ->
        payload = PromptJSON.prompt(prompt)
        json(conn, %{prompt: payload, template: payload})
    end
  end

  def create(conn, params) do
    attrs = create_params(params)

    with {:ok, prompt} <- Store.create_prompt(attrs) do
      payload = PromptJSON.prompt(prompt)

      conn
      |> put_status(:created)
      |> json(%{prompt: payload, template: payload})
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Store.get_prompt(id) do
      nil ->
        {:error, :not_found}

      prompt ->
        attrs = update_params(params)

        with {:ok, updated} <- Store.update_prompt(prompt, attrs) do
          payload = PromptJSON.prompt(updated)
          json(conn, %{prompt: payload, template: payload})
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Store.get_prompt(id) do
      nil ->
        {:error, :not_found}

      prompt ->
        with {:ok, _} <- Store.delete_prompt(prompt) do
          json(conn, %{ok: true, id: id})
        end
    end
  end

  def create_version(conn, %{"id" => id} = params) do
    case Store.get_prompt(id) do
      nil ->
        {:error, :not_found}

      prompt ->
        content = params["content"] || params["body"] || prompt.content
        opts = build_version_opts(prompt, params)

        with {:ok, version} <- Store.create_new_version(prompt.kind, content, opts) do
          payload = PromptJSON.prompt(version)

          conn
          |> put_status(:created)
          |> json(%{prompt: payload, template: payload})
        end
    end
  end

  defp create_params(params) do
    params
    |> Map.put_new("kind", params["name"])
    |> Map.put_new("content", params["body"])
    |> Map.take([
      "id",
      "kind",
      "content",
      "version",
      "status",
      "a_b_test_group",
      "parent_prompt_id",
      "control_prompt_id",
      "metrics",
      "optimizer_metadata"
    ])
    |> drop_nil_values()
  end

  defp update_params(params) do
    params
    |> Map.put_new("kind", params["name"])
    |> Map.put_new("content", params["body"])
    |> Map.take([
      "kind",
      "content",
      "status",
      "a_b_test_group",
      "parent_prompt_id",
      "control_prompt_id",
      "metrics",
      "optimizer_metadata"
    ])
    |> drop_nil_values()
  end

  defp build_version_opts(prompt, params) do
    []
    |> maybe_put_kw(:a_b_test_group, params["a_b_test_group"])
    |> maybe_put_kw(:status, params["status"])
    |> maybe_put_kw(:metrics, params["metrics"])
    |> maybe_put_kw(:optimizer_metadata, params["optimizer_metadata"])
    |> maybe_put_kw(:parent_prompt_id, params["parent_prompt_id"] || prompt.id)
    |> maybe_put_kw(:control_prompt_id, params["control_prompt_id"] || prompt.control_prompt_id)
  end

  defp drop_nil_values(map) do
    map
    |> Enum.reject(fn {_k, v} -> is_nil(v) end)
    |> Map.new()
  end

  defp maybe_put_kw(opts, _key, nil), do: opts
  defp maybe_put_kw(opts, key, value), do: Keyword.put(opts, key, value)

  defp truthy_param?(value) when value in [true, "true", "1", 1, "yes"], do: true
  defp truthy_param?(_), do: false
end
