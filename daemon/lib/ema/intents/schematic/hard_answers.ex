defmodule Ema.Intents.Schematic.HardAnswers do
  @moduledoc """
  Thin wrapper around `Ema.Intents.Schematic.FeedItems` for hard answers.
  """

  alias Ema.Intents.Schematic.FeedItems

  @feed_type "hard_answer"

  def list(opts \\ []), do: FeedItems.list(@feed_type, opts)
  def get(id), do: FeedItems.get(id)
  def request(scope_path, opts \\ []), do: FeedItems.request(@feed_type, scope_path, opts)
  def answer(id, params), do: FeedItems.answer(id, params)
  def escalate_to_chat(id, session_id \\ nil), do: FeedItems.escalate_to_chat(id, session_id)
  def delete(id), do: FeedItems.delete(id)
  def count_open(scope_path \\ nil), do: FeedItems.count_open(@feed_type, scope_path)
end
