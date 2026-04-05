defmodule EmaWeb.PromptJSON do
  @moduledoc false

  alias Ema.Prompts.Prompt

  def prompts(prompts) when is_list(prompts) do
    Enum.map(prompts, &prompt/1)
  end

  def prompt(%Prompt{} = prompt) do
    metadata = prompt.optimizer_metadata || %{}
    metrics = prompt.metrics || %{}

    %{
      id: prompt.id,
      kind: prompt.kind,
      content: prompt.content,
      version: prompt.version,
      status: prompt.status,
      a_b_test_group: prompt.a_b_test_group,
      parent_prompt_id: prompt.parent_prompt_id,
      control_prompt_id: prompt.control_prompt_id,
      metrics: metrics,
      optimizer_metadata: metadata,
      inserted_at: prompt.inserted_at,
      updated_at: prompt.updated_at,
      # Legacy keys retained for backwards compatibility with existing clients
      name: prompt.kind,
      body: prompt.content,
      category: Map.get(metadata, "category"),
      variables: Map.get(metadata, "variables", [])
    }
  end
end
