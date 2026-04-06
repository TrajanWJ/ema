defmodule Ema.Proposals.VaultSeeder do
  @moduledoc """
  Seeds proposals from vault markdown files and a contract library of templates.
  Scans for ideas, TODOs, and unchecked checkboxes in vault notes.
  """

  alias Ema.Proposals

  @idea_patterns [
    ~r/^idea:\s*(.+)/im,
    ~r/^proposal:\s*(.+)/im,
    ~r/^TODO:\s*(.+)/im,
    ~r/^- \[ \]\s*(.+)/m
  ]

  @doc "Scan vault directory for seedable ideas, create proposal seeds."
  def seed_from_vault(vault_path \\ default_vault_path()) do
    vault_path
    |> list_markdown_files()
    |> Enum.flat_map(&extract_ideas/1)
    |> Enum.map(&create_seed/1)
  end

  @doc "Extract and seed ideas from a single file."
  def seed_from_file(file_path, vault_path \\ default_vault_path()) do
    full_path = Path.join(vault_path, file_path)

    full_path
    |> extract_ideas()
    |> Enum.map(&create_seed/1)
  end

  @doc "Return the contract library of named proposal templates."
  def contract_library do
    [
      %{
        name: "feature",
        template: %{
          title: "Feature: [name]",
          summary: "Add [description] to improve [outcome]",
          estimated_scope: "m"
        }
      },
      %{
        name: "refactor",
        template: %{
          title: "Refactor: [area]",
          summary: "Restructure [target] to improve [quality attribute]",
          estimated_scope: "m"
        }
      },
      %{
        name: "research",
        template: %{
          title: "Research: [topic]",
          summary: "Investigate [question] to inform [decision]",
          estimated_scope: "s"
        }
      },
      %{
        name: "fix",
        template: %{
          title: "Fix: [issue]",
          summary: "Resolve [problem] affecting [area]",
          estimated_scope: "s"
        }
      },
      %{
        name: "design",
        template: %{
          title: "Design: [component]",
          summary: "Design [what] to enable [capability]",
          estimated_scope: "l"
        }
      }
    ]
  end

  @doc "Create a proposal seed from a named contract template with overrides."
  def create_from_contract(contract_name, overrides \\ %{}) do
    case Enum.find(contract_library(), &(&1.name == contract_name)) do
      nil ->
        {:error, :unknown_contract}

      %{template: template} ->
        attrs = Map.merge(template, overrides)

        id =
          "seed_#{System.system_time(:second)}_#{:crypto.strong_rand_bytes(3) |> Base.encode16(case: :lower)}"

        Proposals.create_seed(%{
          id: id,
          prompt: attrs[:title] || attrs[:summary],
          context: Jason.encode!(attrs),
          active: true
        })
    end
  end

  # Private

  defp default_vault_path do
    Ema.Config.vault_path()
  end

  defp list_markdown_files(vault_path) do
    case File.ls(vault_path) do
      {:ok, files} ->
        files
        |> Enum.filter(&String.ends_with?(&1, ".md"))
        |> Enum.map(&Path.join(vault_path, &1))

      {:error, _} ->
        []
    end
  end

  defp extract_ideas(file_path) do
    case File.read(file_path) do
      {:ok, content} ->
        @idea_patterns
        |> Enum.flat_map(fn pattern ->
          Regex.scan(pattern, content)
          |> Enum.map(fn
            [_full, capture] -> %{title: String.trim(capture), source: file_path}
            [full] -> %{title: String.trim(full), source: file_path}
          end)
        end)

      {:error, _} ->
        []
    end
  end

  defp create_seed(%{title: title, source: source}) do
    id =
      "seed_#{System.system_time(:second)}_#{:crypto.strong_rand_bytes(3) |> Base.encode16(case: :lower)}"

    Proposals.create_seed(%{
      id: id,
      prompt: title,
      context: "Extracted from vault: #{source}",
      active: false
    })
  end
end
