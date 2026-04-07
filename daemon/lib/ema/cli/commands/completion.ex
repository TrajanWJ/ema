defmodule Ema.CLI.Commands.Completion do
  @moduledoc """
  Generate shell completion scripts for the EMA CLI.

  Usage:
    eval "$(ema completion bash)"   # Add to ~/.bashrc
    eval "$(ema completion zsh)"    # Add to ~/.zshrc
    ema completion fish | source    # Add to ~/.config/fish/config.fish
  """

  def handle(shell) do
    script = generate(shell)
    IO.puts(script)
  end

  def generate("bash"), do: generate_bash()
  def generate("zsh"), do: generate_zsh()
  def generate("fish"), do: generate_fish()

  def generate(other) do
    IO.puts(:stderr, "Unknown shell: #{other}. Supported: bash, zsh, fish")
    System.halt(1)
  end

  defp generate_bash do
    tree = Ema.CLI.command_tree()
    roots = tree |> Map.keys() |> Enum.sort() |> Enum.join(" ")

    sub_cases =
      tree
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.filter(fn {_root, subs} -> subs != [] end)
      |> Enum.map(fn {root, subs} ->
        sub_words = subs |> Enum.sort() |> Enum.join(" ")
        "        #{root})\n          COMPREPLY=( $(compgen -W \"#{sub_words}\" -- \"$cur\") )\n          ;;"
      end)
      |> Enum.join("\n")

    """
    _ema_completion() {
      local cur prev words cword
      COMPREPLY=()
      _get_comp_words_by_ref -n : cur prev words cword 2>/dev/null || {
        cur="${COMP_WORDS[COMP_CWORD]}"
        prev="${COMP_WORDS[COMP_CWORD-1]}"
        words=("${COMP_WORDS[@]}")
        cword=$COMP_CWORD
      }

      local commands="#{roots}"

      if [[ $cword -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
        return
      fi

      case "${words[1]}" in
    #{sub_cases}
      esac
    }
    complete -o default -F _ema_completion ema
    """
  end

  defp generate_zsh do
    tree = Ema.CLI.command_tree()

    root_entries =
      tree
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.map(fn {root, _subs} ->
        "    '#{root}:#{root} management'"
      end)
      |> Enum.join("\n")

    sub_cases =
      tree
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.filter(fn {_root, subs} -> subs != [] end)
      |> Enum.map(fn {root, subs} ->
        sub_list =
          subs
          |> Enum.sort()
          |> Enum.map(&"'#{&1}'")
          |> Enum.join(" ")

        "    #{root})\n      local -a subcommands=(#{sub_list})\n      _describe 'subcommand' subcommands\n      ;;"
      end)
      |> Enum.join("\n")

    """
    #compdef ema

    _ema() {
      local -a commands

      if (( CURRENT == 2 )); then
        commands=(
    #{root_entries}
        )
        _describe 'command' commands
        return
      fi

      case "${words[2]}" in
    #{sub_cases}
      esac
    }

    _ema "$@"
    """
  end

  defp generate_fish do
    tree = Ema.CLI.command_tree()

    root_completions =
      tree
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.map(fn {root, _subs} ->
        "complete -c ema -n '__fish_use_subcommand' -a '#{root}' -d '#{root}'"
      end)
      |> Enum.join("\n")

    sub_completions =
      tree
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.filter(fn {_root, subs} -> subs != [] end)
      |> Enum.flat_map(fn {root, subs} ->
        Enum.sort(subs)
        |> Enum.map(fn sub ->
          "complete -c ema -n '__fish_seen_subcommand_from #{root}' -a '#{sub}' -d '#{sub}'"
        end)
      end)
      |> Enum.join("\n")

    """
    # EMA CLI completions for fish

    #{root_completions}

    #{sub_completions}
    """
  end
end
