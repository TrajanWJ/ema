defmodule Ema.Context.Adapters.RuntimeAdapter do
  @moduledoc "Runtime truth adapter placeholder."
  @behaviour Ema.Context.Adapter
  alias Ema.Context.SourceItem

  @impl true
  def fetch(_opts \\ []) do
    [
      %SourceItem{
        id: "runtime-status",
        source_kind: :runtime,
        source_ref: "/api/status",
        entity_kind: :runtime_status,
        title: "Runtime status",
        summary: "Runtime adapter placeholder",
        body: "Replace with live API/service/process truth aggregation.",
        timestamp: DateTime.utc_now(),
        freshness_score: 1.0,
        confidence_score: 0.7,
        authority_level: :runtime,
        sensitivity: :internal
      }
    ]
  end
end
