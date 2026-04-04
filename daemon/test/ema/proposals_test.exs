defmodule Ema.ProposalsTest do
  use Ema.DataCase, async: false
  alias Ema.Proposals
  alias Ema.Proposals.Proposal
  alias Ema.Projects

  # --- Helper ---

  defp create_project(slug \\ "test-proj") do
    {:ok, project} = Projects.create_project(%{slug: slug, name: "Test Project"})
    project
  end

  defp create_seed(attrs \\ %{}) do
    defaults = %{
      name: "Test Seed",
      prompt_template: "Generate something useful",
      seed_type: "cron"
    }

    {:ok, seed} = Proposals.create_seed(Map.merge(defaults, attrs))
    seed
  end

  defp create_proposal(attrs \\ %{}) do
    defaults = %{
      title: "Test Proposal",
      summary: "A test proposal summary",
      body: "Detailed proposal body"
    }

    {:ok, proposal} = Proposals.create_proposal(Map.merge(defaults, attrs))
    proposal
  end

  # --- Proposals CRUD ---

  describe "create_proposal/1" do
    test "creates a proposal with valid attrs" do
      assert {:ok, proposal} = Proposals.create_proposal(%{title: "New Idea"})
      assert proposal.title == "New Idea"
      assert proposal.status == "queued"
      assert String.starts_with?(proposal.id, "prop_")
    end

    test "fails without required title" do
      assert {:error, changeset} = Proposals.create_proposal(%{})
      assert %{title: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates status" do
      assert {:error, changeset} = Proposals.create_proposal(%{title: "X", status: "bogus"})
      assert %{status: [_]} = errors_on(changeset)
    end

    test "validates confidence range" do
      assert {:error, changeset} = Proposals.create_proposal(%{title: "X", confidence: 1.5})
      assert %{confidence: [_]} = errors_on(changeset)
    end

    test "returns the existing proposal when source_fingerprint already exists" do
      attrs = %{title: "Fingerprint Test", source_fingerprint: "vault:abc123"}

      assert {:ok, first} = Proposals.create_proposal(attrs)
      assert {:ok, second} = Proposals.create_proposal(attrs)

      assert first.id == second.id
      assert Repo.aggregate(Proposal, :count, :id) == 1
    end

    test "accepts all optional fields" do
      project = create_project()
      seed = create_seed(%{project_id: project.id})

      attrs = %{
        title: "Full Proposal",
        summary: "Summary here",
        body: "Body here",
        status: "queued",
        confidence: 0.85,
        risks: ["risk1", "risk2"],
        benefits: ["benefit1"],
        estimated_scope: "m",
        steelman: "Good because...",
        red_team: "Bad because...",
        synthesis: "On balance...",
        generation_log: %{"step" => "value"},
        project_id: project.id,
        seed_id: seed.id
      }

      assert {:ok, proposal} = Proposals.create_proposal(attrs)
      assert proposal.confidence == 0.85
      assert proposal.risks == ["risk1", "risk2"]
      assert proposal.benefits == ["benefit1"]
      assert proposal.estimated_scope == "m"
      assert proposal.project_id == project.id
      assert proposal.seed_id == seed.id
    end
  end

  describe "list_proposals/1" do
    test "returns all proposals" do
      create_proposal(%{title: "A"})
      create_proposal(%{title: "B"})
      assert length(Proposals.list_proposals()) == 2
    end

    test "filters by status" do
      create_proposal(%{title: "Queued", status: "queued"})
      create_proposal(%{title: "Approved", status: "approved"})
      assert [p] = Proposals.list_proposals(status: "approved")
      assert p.title == "Approved"
    end

    test "filters by project_id" do
      project = create_project()
      create_proposal(%{title: "Scoped", project_id: project.id})
      create_proposal(%{title: "Global"})
      assert [p] = Proposals.list_proposals(project_id: project.id)
      assert p.title == "Scoped"
    end

    test "respects limit" do
      for i <- 1..5, do: create_proposal(%{title: "P#{i}"})
      assert length(Proposals.list_proposals(limit: 3)) == 3
    end
  end

  describe "get_proposal/1" do
    test "returns proposal with preloaded tags and children" do
      proposal = create_proposal()
      assert fetched = Proposals.get_proposal(proposal.id)
      assert fetched.id == proposal.id
    end

    test "returns nil for unknown id" do
      assert Proposals.get_proposal("nonexistent") == nil
    end
  end

  describe "update_proposal/2" do
    test "updates proposal fields" do
      proposal = create_proposal()
      assert {:ok, updated} = Proposals.update_proposal(proposal, %{title: "Updated Title"})
      assert updated.title == "Updated Title"
    end
  end

  # --- Actions ---

  describe "approve_proposal/1" do
    test "sets status to approved" do
      proposal = create_proposal()
      assert {:ok, approved} = Proposals.approve_proposal(proposal.id)
      assert approved.status == "approved"
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = Proposals.approve_proposal("nope")
    end
  end

  describe "redirect_proposal/2" do
    test "sets status to redirected and creates 3 seeds" do
      proposal = create_proposal()

      assert {:ok, redirected, seeds} =
               Proposals.redirect_proposal(proposal.id, "try a different angle")

      assert redirected.status == "redirected"
      assert length(seeds) == 3
      assert Enum.all?(seeds, &(&1.seed_type == "dependency"))
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = Proposals.redirect_proposal("nope", "note")
    end
  end

  describe "kill_proposal/1" do
    test "sets status to killed" do
      proposal = create_proposal()
      assert {:ok, killed} = Proposals.kill_proposal(proposal.id)
      assert killed.status == "killed"
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = Proposals.kill_proposal("nope")
    end
  end

  # --- Lineage ---

  describe "get_lineage/1" do
    test "returns parent chain and children" do
      parent = create_proposal(%{title: "Parent"})

      child =
        create_proposal(%{
          title: "Child",
          parent_proposal_id: parent.id
        })

      grandchild =
        create_proposal(%{
          title: "Grandchild",
          parent_proposal_id: child.id
        })

      assert {:ok, lineage} = Proposals.get_lineage(child.id)
      assert lineage.proposal.id == child.id
      assert length(lineage.parents) == 1
      assert hd(lineage.parents).id == parent.id
      assert length(lineage.children) == 1
      assert hd(lineage.children).id == grandchild.id
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = Proposals.get_lineage("nope")
    end
  end

  # --- Seeds CRUD ---

  describe "create_seed/1" do
    test "creates a seed with valid attrs" do
      seed = create_seed()
      assert seed.name == "Test Seed"
      assert seed.seed_type == "cron"
      assert seed.active == true
      assert seed.run_count == 0
      assert String.starts_with?(seed.id, "seed_")
    end

    test "fails without required fields" do
      assert {:error, changeset} = Proposals.create_seed(%{})
      errors = errors_on(changeset)
      assert errors[:name]
      assert errors[:prompt_template]
      assert errors[:seed_type]
    end

    test "validates seed_type" do
      assert {:error, changeset} =
               Proposals.create_seed(%{
                 name: "Bad",
                 prompt_template: "x",
                 seed_type: "invalid"
               })

      assert %{seed_type: [_]} = errors_on(changeset)
    end
  end

  describe "list_seeds/1" do
    test "returns all seeds" do
      create_seed(%{name: "A"})
      create_seed(%{name: "B"})
      assert length(Proposals.list_seeds()) == 2
    end

    test "filters by active" do
      create_seed(%{name: "Active", active: true})
      create_seed(%{name: "Inactive", active: false})
      assert [s] = Proposals.list_seeds(active: true)
      assert s.name == "Active"
    end

    test "filters by seed_type" do
      create_seed(%{name: "Cron", seed_type: "cron"})
      create_seed(%{name: "Git", seed_type: "git"})
      assert [s] = Proposals.list_seeds(seed_type: "git")
      assert s.name == "Git"
    end
  end

  describe "toggle_seed/1" do
    test "toggles active flag" do
      seed = create_seed(%{active: true})
      assert {:ok, toggled} = Proposals.toggle_seed(seed.id)
      assert toggled.active == false

      assert {:ok, toggled_back} = Proposals.toggle_seed(seed.id)
      assert toggled_back.active == true
    end

    test "returns error for nonexistent id" do
      assert {:error, :not_found} = Proposals.toggle_seed("nope")
    end
  end

  describe "increment_seed_run_count/1" do
    test "increments run count and sets last_run_at" do
      seed = create_seed()
      assert seed.run_count == 0
      assert seed.last_run_at == nil

      assert {:ok, updated} = Proposals.increment_seed_run_count(seed)
      assert updated.run_count == 1
      assert updated.last_run_at != nil
    end
  end

  # --- Tags ---

  describe "add_tag/2 and list_tags/1" do
    test "adds and lists tags for a proposal" do
      proposal = create_proposal()

      assert {:ok, tag} =
               Proposals.add_tag(proposal.id, %{category: "domain", label: "backend"})

      assert tag.category == "domain"
      assert tag.label == "backend"
      assert String.starts_with?(tag.id, "ptag_")

      assert {:ok, _} =
               Proposals.add_tag(proposal.id, %{category: "type", label: "enhancement"})

      tags = Proposals.list_tags(proposal.id)
      assert length(tags) == 2
    end

    test "validates tag category" do
      proposal = create_proposal()

      assert {:error, changeset} =
               Proposals.add_tag(proposal.id, %{category: "invalid", label: "test"})

      assert %{category: [_]} = errors_on(changeset)
    end
  end
end
