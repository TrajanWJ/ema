defmodule Ema.Integrations.GitHub.Client do
  @moduledoc "Req-based HTTP client for GitHub API."

  @base_url "https://api.github.com"

  def get_token do
    Ema.Settings.get("github_token")
  end

  def list_repos do
    with {:ok, token} <- require_token() do
      Req.get("#{@base_url}/user/repos",
        headers: headers(token),
        params: [per_page: 100, sort: "updated"]
      )
      |> handle_response()
    end
  end

  def get_commits(repo_full_name) do
    with {:ok, token} <- require_token() do
      Req.get("#{@base_url}/repos/#{repo_full_name}/commits",
        headers: headers(token),
        params: [per_page: 30]
      )
      |> handle_response()
    end
  end

  defp require_token do
    case get_token() do
      nil -> {:error, :no_token}
      "" -> {:error, :no_token}
      token -> {:ok, token}
    end
  end

  defp headers(token) do
    [
      {"authorization", "Bearer #{token}"},
      {"accept", "application/vnd.github+json"},
      {"x-github-api-version", "2022-11-28"}
    ]
  end

  defp handle_response({:ok, %Req.Response{status: status, body: body}}) when status in 200..299 do
    {:ok, body}
  end

  defp handle_response({:ok, %Req.Response{status: status, body: body}}) do
    {:error, %{status: status, body: body}}
  end

  defp handle_response({:error, reason}) do
    {:error, reason}
  end
end
