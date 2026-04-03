defmodule Ema.Intelligence.SupermanClient do
  @moduledoc """
  HTTP client for the Superman code intelligence API.
  """

  @default_url "http://localhost:3000"

  defp base_url do
    System.get_env("SUPERMAN_URL", @default_url)
  end

  def health_check do
    case Req.get("#{base_url()}/") do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "unexpected status #{status}"}
      {:error, reason} -> {:error, reason}
    end
  end

  def get_status do
    case Req.get("#{base_url()}/project/info") do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "unexpected status #{status}"}
      {:error, reason} -> {:error, reason}
    end
  end

  def index_repo(repo_path) do
    case Req.post("#{base_url()}/project/set", json: %{path: repo_path}) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status, body: body}} -> {:error, %{status: status, body: body}}
      {:error, reason} -> {:error, reason}
    end
  end

  def ask_codebase(query, _repo_path) do
    case Req.post("#{base_url()}/query", json: %{question: query}, receive_timeout: 120_000) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status, body: body}} -> {:error, %{status: status, body: body}}
      {:error, reason} -> {:error, reason}
    end
  end

  def get_gaps do
    case Req.get("#{base_url()}/suggestions") do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "unexpected status #{status}"}
      {:error, reason} -> {:error, reason}
    end
  end

  def get_flows do
    case Req.get("#{base_url()}/project/flows") do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "unexpected status #{status}"}
      {:error, reason} -> {:error, reason}
    end
  end

  def apply_task(instruction) do
    case Req.post("#{base_url()}/apply-changes",
           json: %{instruction: instruction},
           receive_timeout: 180_000
         ) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status, body: body}} -> {:error, %{status: status, body: body}}
      {:error, reason} -> {:error, reason}
    end
  end

  def get_intent_graph do
    case Req.get("#{base_url()}/intent-graph") do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "unexpected status #{status}"}
      {:error, reason} -> {:error, reason}
    end
  end

  def simulate_flow(entry_point) do
    case Req.post("#{base_url()}/simulate",
           json: %{entryPoint: entry_point},
           receive_timeout: 120_000
         ) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status, body: body}} -> {:error, %{status: status, body: body}}
      {:error, reason} -> {:error, reason}
    end
  end

  def autonomous_run do
    case Req.post("#{base_url()}/project/self-evolve",
           json: %{maxIterations: 5},
           receive_timeout: 300_000
         ) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status, body: body}} -> {:error, %{status: status, body: body}}
      {:error, reason} -> {:error, reason}
    end
  end

  def get_panels do
    case Req.get("#{base_url()}/project/panels") do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "unexpected status #{status}"}
      {:error, reason} -> {:error, reason}
    end
  end

  def build_task(task) do
    case Req.post("#{base_url()}/project/build",
           json: %{task: task},
           receive_timeout: 180_000
         ) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: status, body: body}} -> {:error, %{status: status, body: body}}
      {:error, reason} -> {:error, reason}
    end
  end
end
