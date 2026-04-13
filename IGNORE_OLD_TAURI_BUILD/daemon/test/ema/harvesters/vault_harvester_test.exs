defmodule Ema.Harvesters.VaultHarvesterTest do
  use Ema.DataCase, async: false

  alias Ema.Harvesters.VaultHarvester
  alias Ema.Proposals

  setup do
    vault_path =
      Path.join(System.tmp_dir!(), "ema-vault-harvester-#{System.unique_integer([:positive])}")

    File.mkdir_p!(vault_path)

    previous_vault_path = Application.get_env(:ema, :vault_path)
    Application.put_env(:ema, :vault_path, vault_path)

    on_exit(fn ->
      if previous_vault_path do
        Application.put_env(:ema, :vault_path, previous_vault_path)
      else
        Application.delete_env(:ema, :vault_path)
      end

      File.rm_rf!(vault_path)
    end)

    %{vault_path: vault_path}
  end

  test "repeated harvest runs do not create duplicate proposals", %{vault_path: vault_path} do
    note_path = Path.join(vault_path, "projects/sample.md")
    File.mkdir_p!(Path.dirname(note_path))

    File.write!(note_path, """
    TODO: Fix the ingestion race
    IDEA: Add an interactive dashboard
    QUESTION: Why is the retry budget so high?
    """)

    assert {:ok, first_run} = VaultHarvester.harvest(%{})
    assert first_run.items_found == 3
    assert first_run.seeds_created == 3
    assert length(Proposals.list_proposals()) == 3

    assert {:ok, second_run} = VaultHarvester.harvest(%{})
    assert second_run.items_found == 3
    assert second_run.seeds_created == 0
    assert length(Proposals.list_proposals()) == 3
  end
end
