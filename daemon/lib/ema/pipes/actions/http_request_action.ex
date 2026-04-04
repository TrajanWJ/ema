defmodule Ema.Pipes.Actions.HttpRequestAction do
  @moduledoc """
  Pipes Action: Outbound HTTP Request.

  Makes an HTTP request using `Req` and merges the response body into the
  pipe payload at the configured key.

  ## Config Keys

    - `url`           — request URL (supports {{var}} interpolation)
    - `method`        — "get" | "post" | "put" | "patch" | "delete" (default: "get")
    - `headers`       — map of request headers
    - `body_template` — string with {{variable}} placeholders from payload (for POST/PUT)
    - `response_key`  — payload key to store response body (default: "http_response")
    - `timeout_ms`    — request timeout in ms (default: 30_000)

  ## Example Pipe Config

      %{
        action_id: "http:request",
        config: %{
          "url" => "https://api.example.com/items/{{id}}",
          "method" => "post",
          "headers" => %{"Authorization" => "Bearer {{token}}"},
          "body_template" => ~s({"content": "{{content}}"}),
          "response_key" => "api_result"
        }
      }
  """

  require Logger

  @default_response_key "http_response"
  @default_timeout_ms 30_000

  @doc "Execute HTTP request and merge response into payload."
  def execute(payload, config) do
    config = normalize_config(config)

    with {:ok, url} <- render_template(config.url, payload),
         {:ok, body} <- build_body(payload, config),
         headers = render_headers(config.headers, payload) do
      Logger.debug("[HttpRequestAction] #{String.upcase(config.method)} #{url}")

      req_opts =
        [
          url: url,
          headers: headers,
          receive_timeout: config.timeout_ms
        ]
        |> maybe_add_body(config.method, body)

      case make_request(config.method, req_opts) do
        {:ok, %Req.Response{status: status, body: resp_body}} when status in 200..299 ->
          result = parse_response_body(resp_body)
          {:ok, Map.put(payload, config.response_key, result)}

        {:ok, %Req.Response{status: status, body: resp_body}} ->
          Logger.warning("[HttpRequestAction] HTTP #{status}: #{inspect(resp_body)}")
          {:error, {:http_error, status, resp_body}}

        {:error, reason} ->
          Logger.error("[HttpRequestAction] Request failed: #{inspect(reason)}")
          {:error, {:request_failed, reason}}
      end
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp normalize_config(config) when is_map(config) do
    %{
      url: config["url"] || config[:url] || "",
      method: String.downcase(config["method"] || config[:method] || "get"),
      headers: config["headers"] || config[:headers] || %{},
      body_template: config["body_template"] || config[:body_template],
      response_key: config["response_key"] || config[:response_key] || @default_response_key,
      timeout_ms: config["timeout_ms"] || config[:timeout_ms] || @default_timeout_ms
    }
  end

  defp render_template(template, payload) when is_binary(template) do
    rendered =
      Regex.replace(~r/\{\{(\w+)\}\}/, template, fn _, key ->
        val = payload[key] || payload[String.to_atom(key)]
        to_string(val || "")
      end)

    {:ok, rendered}
  rescue
    e -> {:error, {:template_render_failed, Exception.message(e)}}
  end

  defp render_headers(headers, payload) when is_map(headers) do
    Enum.map(headers, fn {k, v} ->
      rendered_v =
        Regex.replace(~r/\{\{(\w+)\}\}/, to_string(v), fn _, key ->
          val = payload[key] || payload[String.to_atom(key)]
          to_string(val || "")
        end)

      {to_string(k), rendered_v}
    end)
  rescue
    _ -> []
  end

  defp render_headers(_, _), do: []

  defp build_body(payload, %{body_template: nil}), do: {:ok, nil}
  defp build_body(payload, %{body_template: template}), do: render_template(template, payload)

  defp maybe_add_body(opts, method, body) when method in ["post", "put", "patch"] and not is_nil(body) do
    Keyword.put(opts, :body, body)
  end

  defp maybe_add_body(opts, _, _), do: opts

  defp make_request("get", opts), do: Req.get(opts)
  defp make_request("post", opts), do: Req.post(opts)
  defp make_request("put", opts), do: Req.put(opts)
  defp make_request("patch", opts), do: Req.patch(opts)
  defp make_request("delete", opts), do: Req.delete(opts)
  defp make_request(method, _opts), do: {:error, {:unsupported_method, method}}

  defp parse_response_body(body) when is_map(body), do: body
  defp parse_response_body(body) when is_list(body), do: body
  defp parse_response_body(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, parsed} -> parsed
      _ -> body
    end
  end

  defp parse_response_body(body), do: body
end
