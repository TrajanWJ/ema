defmodule Ema.VaultIndex do
  @moduledoc """
  Deprecated: replaced by vault_notes + vault_links tables.
  See VaultNotes context (to be implemented in a later plan).
  """

  @doc """
  Stub — semantic search not yet implemented.
  Returns an empty list so callers don't crash at runtime.
  """
  def semantic_search(_query, _opts \\ []), do: []
end
