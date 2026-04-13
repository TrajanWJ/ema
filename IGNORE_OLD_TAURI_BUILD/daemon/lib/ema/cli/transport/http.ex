defmodule Ema.CLI.Transport.Http do
  @moduledoc "HTTP transport — calls daemon REST API via Req."
  @behaviour Ema.CLI.Transport

  @default_base "http://localhost:4488/api"

  @impl true
  def call(_module, _function, _args) do
    {:error, "HTTP transport: use request/3 instead of call/3"}
  end

  @doc "GET request to daemon API"
  @spec get(String.t(), keyword()) :: {:ok, term()} | {:error, term()}
  def get(path, opts \\ []) do
    request(:get, path, opts)
  end

  @doc "POST request to daemon API"
  @spec post(String.t(), map(), keyword()) :: {:ok, term()} | {:error, term()}
  def post(path, body \\ %{}, opts \\ []) do
    request(:post, path, Keyword.put(opts, :json, body))
  end

  @doc "PUT request to daemon API"
  @spec put(String.t(), map(), keyword()) :: {:ok, term()} | {:error, term()}
  def put(path, body \\ %{}, opts \\ []) do
    request(:put, path, Keyword.put(opts, :json, body))
  end

  @doc "DELETE request to daemon API"
  @spec delete(String.t(), keyword()) :: {:ok, term()} | {:error, term()}
  def delete(path, opts \\ []) do
    request(:delete, path, opts)
  end

  defp request(method, path, opts) do
    base = base_url()
    url = "#{base}#{path}"
    params = Keyword.get(opts, :params, [])
    json = Keyword.get(opts, :json)

    req_opts =
      [url: url, method: method, receive_timeout: 15_000, retry: false]
      |> maybe_add(:params, params)
      |> maybe_add(:json, json)

    case Req.request(req_opts) do
      {:ok, %{status: s, body: body}} when s in 200..299 ->
        {:ok, body}

      {:ok, %{status: 404}} ->
        {:error, :not_found}

      {:ok, %{status: 422, body: %{"errors" => errors}}} ->
        {:error, {:validation, errors}}

      {:ok, %{status: status, body: body}} ->
        {:error, "HTTP #{status}: #{inspect(body)}"}

      {:error, %{reason: reason}} ->
        {:error, "Connection failed: #{inspect(reason)}"}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end

  defp base_url do
    System.get_env("EMA_HOST") || @default_base
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, _key, []), do: opts
  defp maybe_add(opts, key, value), do: Keyword.put(opts, key, value)
end
