defmodule Ema.Standards.HooksInstaller do
  @moduledoc """
  Installs an EMA-managed git pre-commit hook in a target repository.

  The installed hook blocks commits containing:
    * debug statements (`IO.inspect`, `console.log`, `dbg!`, `pp `)
    * hardcoded API keys (sk-*, ghp_*, AKIA*, xoxb-*, etc.)
    * `TODO` / `FIXME` without an issue reference like `#123`

  Existing hooks are backed up to `pre-commit.bak` before being replaced
  unless they were also written by EMA (we detect our own marker).
  """

  @marker "# EMA-MANAGED-HOOK"

  @spec install(Path.t()) :: {:ok, Path.t()} | {:error, term()}
  def install(repo_path \\ File.cwd!()) do
    with {:ok, hooks_dir} <- find_hooks_dir(repo_path),
         hook_path = Path.join(hooks_dir, "pre-commit"),
         :ok <- maybe_backup(hook_path),
         :ok <- File.write(hook_path, hook_script()),
         :ok <- File.chmod(hook_path, 0o755) do
      {:ok, hook_path}
    end
  end

  defp find_hooks_dir(repo_path) do
    git_dir = Path.join(repo_path, ".git")

    cond do
      File.dir?(git_dir) ->
        {:ok, Path.join([git_dir, "hooks"]) |> tap(&File.mkdir_p!/1)}

      File.regular?(git_dir) ->
        # Worktree or submodule: parse `gitdir: <path>`
        case File.read(git_dir) do
          {:ok, "gitdir: " <> rest} ->
            real = rest |> String.trim() |> Path.expand(repo_path)
            {:ok, Path.join(real, "hooks") |> tap(&File.mkdir_p!/1)}

          _ ->
            {:error, :not_a_git_repo}
        end

      true ->
        {:error, :not_a_git_repo}
    end
  end

  defp maybe_backup(hook_path) do
    case File.read(hook_path) do
      {:error, :enoent} ->
        :ok

      {:ok, contents} ->
        if String.contains?(contents, @marker) do
          :ok
        else
          File.write(hook_path <> ".bak", contents)
        end

      err ->
        err
    end
  end

  defp hook_script do
    """
    #!/usr/bin/env bash
    #{@marker}
    # Installed by `ema install hooks`. See:
    #   ~/.local/share/ema/vault/wiki/Operations/EMA-Best-Practices.md
    #
    # To bypass for one commit (last resort): git commit --no-verify

    set -euo pipefail

    files=$(git diff --cached --name-only --diff-filter=ACM)
    [ -z "$files" ] && exit 0

    fail=0

    # 1. Debug statements
    if echo "$files" | xargs --no-run-if-empty grep -nE \
        '(IO\\.inspect|console\\.log|dbg!|^[[:space:]]*pp [^=])' 2>/dev/null; then
      echo
      echo "ema: debug statements found above. Remove them or use --no-verify (don't)."
      fail=1
    fi

    # 2. Hardcoded API keys
    if echo "$files" | xargs --no-run-if-empty grep -nE \
        '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xoxb-[A-Za-z0-9-]+)' 2>/dev/null; then
      echo
      echo "ema: hardcoded credential found above. Move it to env vars."
      fail=1
    fi

    # 3. TODO / FIXME without issue reference (#123, EMA-456, etc)
    if echo "$files" | xargs --no-run-if-empty grep -nE \
        '(TODO|FIXME)([^#A-Z]|$)' 2>/dev/null | grep -v -E '#[0-9]+|[A-Z]+-[0-9]+'; then
      echo
      echo "ema: TODO/FIXME without issue reference. Use 'TODO(#123): ...' or 'FIXME(EMA-456): ...'"
      fail=1
    fi

    if [ "$fail" -ne 0 ]; then
      echo
      echo "ema standards: pre-commit failed. See wiki/Operations/EMA-Best-Practices.md"
      exit 1
    fi
    """
  end
end
