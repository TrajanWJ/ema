defmodule Ema.Executions.RouterTest do
  use ExUnit.Case, async: true

  alias Ema.Executions.Router

  # ── classify_mode/1 ──────────────────────────────────────────────────────────

  describe "classify_mode/1" do
    test "research → exploration, phase 1" do
      assert Router.classify_mode("research") == {:exploration, 1}
    end

    test "outline → specification, phase 2" do
      assert Router.classify_mode("outline") == {:specification, 2}
    end

    test "implement → execution, phase 3" do
      assert Router.classify_mode("implement") == {:execution, 3}
    end

    test "review → validation, phase 4" do
      assert Router.classify_mode("review") == {:validation, 4}
    end

    test "refactor → maintenance, phase 4" do
      assert Router.classify_mode("refactor") == {:maintenance, 4}
    end

    test "harvest → maintenance, phase 5" do
      assert Router.classify_mode("harvest") == {:maintenance, 5}
    end

    test "unknown mode → adhoc, phase 0" do
      assert Router.classify_mode("whatever") == {:adhoc, 0}
      assert Router.classify_mode("") == {:adhoc, 0}
    end
  end

  # ── classify_outcome/1 ──────────────────────────────────────────────────────

  describe "classify_outcome/1" do
    test "nil → unknown" do
      assert Router.classify_outcome(nil) == :unknown
    end

    test "empty string → unknown" do
      assert Router.classify_outcome("") == :unknown
    end

    test "FAILED: prefix → failed" do
      assert Router.classify_outcome("FAILED: timeout after 120s") == :failed
    end

    test "Elixir exception trace → failed" do
      assert Router.classify_outcome("something went wrong ** (exit) :timeout") == :failed
    end

    test "ERROR: on its own line → failed" do
      assert Router.classify_outcome("some output\nERROR: compilation failed\nmore") == :failed
    end

    test "short string (< 100 bytes) → partial" do
      assert Router.classify_outcome("ok done") == :partial
    end

    test "structured markdown with headers (> 200 bytes) → success" do
      result = "# Research Results\n\n" <> String.duplicate("Analysis content here. ", 15)
      assert byte_size(result) > 200
      assert Router.classify_outcome(result) == :success
    end

    test "long unstructured text (>= 300 bytes) → success" do
      result = String.duplicate("This is a paragraph of output text. ", 12)
      assert byte_size(result) >= 300
      assert Router.classify_outcome(result) == :success
    end

    test "medium unstructured text (100-299 bytes) → partial" do
      result = String.duplicate("Some medium output. ", 7)
      assert byte_size(result) >= 100
      assert byte_size(result) < 300
      refute Regex.match?(~r/^#+ /m, result)
      assert Router.classify_outcome(result) == :partial
    end
  end

  # ── mode_to_role/1 ─────────────────────────────────────────────────────────

  describe "mode_to_role/1" do
    test "maps each mode to the correct role" do
      assert Router.mode_to_role("research") == "researcher"
      assert Router.mode_to_role("outline") == "outliner"
      assert Router.mode_to_role("review") == "reviewer"
      assert Router.mode_to_role("refactor") == "refactorer"
      assert Router.mode_to_role("harvest") == "harvester"
    end

    test "unknown mode defaults to implementer" do
      assert Router.mode_to_role("implement") == "implementer"
      assert Router.mode_to_role("anything") == "implementer"
    end
  end

  # ── mode_success_criteria/1 ────────────────────────────────────────────────

  describe "mode_success_criteria/1" do
    test "research has 4 criteria" do
      assert length(Router.mode_success_criteria("research")) == 4
    end

    test "outline has 5 criteria" do
      assert length(Router.mode_success_criteria("outline")) == 5
    end

    test "other modes get default criteria" do
      assert Router.mode_success_criteria("implement") == [
               "Objective completed",
               "Output written to specified files"
             ]
    end
  end

  # ── mode_read_files/2 and mode_write_files/2 ──────────────────────────────

  describe "mode_read_files/2" do
    test "outline reads research.md" do
      assert Router.mode_read_files("outline", "/path/to/intent") == [
               "/path/to/intent/research.md"
             ]
    end

    test "other modes return empty list" do
      assert Router.mode_read_files("research", "/path") == []
      assert Router.mode_read_files("implement", "/path") == []
    end
  end

  describe "mode_write_files/2" do
    test "research writes research.md" do
      assert Router.mode_write_files("research", "/p") == ["/p/research.md"]
    end

    test "outline writes outline.md and decisions.md" do
      assert Router.mode_write_files("outline", "/p") == ["/p/outline.md", "/p/decisions.md"]
    end

    test "other modes write result.md" do
      assert Router.mode_write_files("implement", "/p") == ["/p/result.md"]
    end
  end

  # ── infer_mode_from_text/1 ────────────────────────────────────────────────

  describe "infer_mode_from_text/1" do
    test "research keywords" do
      assert Router.infer_mode_from_text("Investigate the database schema") == "research"
      assert Router.infer_mode_from_text("Research viable options") == "research"
    end

    test "refactor keywords" do
      assert Router.infer_mode_from_text("Refactor the auth module") == "refactor"
      assert Router.infer_mode_from_text("Clean up dead code") == "refactor"
    end

    test "review keywords" do
      assert Router.infer_mode_from_text("Review the API endpoints") == "review"
      assert Router.infer_mode_from_text("Audit security headers") == "review"
    end

    test "outline keywords" do
      assert Router.infer_mode_from_text("Design the new pipeline") == "outline"
      assert Router.infer_mode_from_text("Plan the migration strategy") == "outline"
    end

    test "defaults to implement" do
      assert Router.infer_mode_from_text("Add user avatar upload") == "implement"
    end
  end

  # ── classify/2 integration ────────────────────────────────────────────────

  describe "classify/2" do
    test "returns full classification struct" do
      long_result = "# Done\n\n" <> String.duplicate("Completed the work successfully. ", 12)
      classification = Router.classify("research", long_result)

      assert classification.mode == "research"
      assert classification.mode_class == :exploration
      assert classification.phase == 1
      assert classification.outcome_signal == :success
      assert classification.agent_role == "researcher"
    end

    test "eligible_next_modes populated on success" do
      long_result = String.duplicate("x", 300)
      classification = Router.classify("research", long_result)

      assert classification.outcome_signal == :success
      assert classification.eligible_next_modes == ["outline"]
    end

    test "eligible_next_modes is [mode] on failure" do
      classification = Router.classify("research", "FAILED: timeout")

      assert classification.outcome_signal == :failed
      assert classification.eligible_next_modes == ["research"]
    end

    test "eligible_next_modes is [mode] on partial" do
      classification = Router.classify("implement", "ok")

      assert classification.outcome_signal == :partial
      assert classification.eligible_next_modes == ["implement"]
    end

    test "unknown mode gets adhoc classification" do
      classification = Router.classify("custom", String.duplicate("x", 300))

      assert classification.mode_class == :adhoc
      assert classification.phase == 0
      assert classification.agent_role == "implementer"
    end

    test "harvest success has empty eligible_next_modes" do
      classification = Router.classify("harvest", String.duplicate("x", 300))

      assert classification.outcome_signal == :success
      assert classification.eligible_next_modes == []
    end
  end
end
