import { useState } from "react";
import { useOrgStore } from "@/stores/org-store";
import type { Organization } from "@/types/org";

interface Props {
  onBack: () => void;
  onCreated: (org: Organization) => void;
}

export function CreateOrgForm({ onBack, onCreated }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    if (!slug || slug === toSlug(name)) {
      setSlug(toSlug(val));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setSaving(true);
    try {
      const org = await useOrgStore.getState().createOrg({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      });
      onCreated(org);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="text-[0.7rem] px-2 py-0.5 rounded hover:bg-white/5"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          &larr; Back
        </button>
        <h2 className="text-[0.85rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
          Create Organization
        </h2>
      </div>

      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Name</label>
        <input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.75rem] outline-none"
          style={{ color: "var(--pn-text-primary)" }}
          placeholder="My Organization"
          autoFocus
        />
      </div>

      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.75rem] outline-none font-mono"
          style={{ color: "var(--pn-text-primary)" }}
          placeholder="my-org"
        />
      </div>

      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.75rem] outline-none resize-none"
          style={{ color: "var(--pn-text-primary)" }}
          rows={3}
          placeholder="What is this organization for?"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !name.trim() || !slug.trim()}
        className="w-full text-[0.75rem] py-2 rounded font-medium transition-all disabled:opacity-40"
        style={{ background: "rgba(45, 212, 168, 0.15)", color: "#2dd4a8" }}
      >
        {saving ? "Creating..." : "Create Organization"}
      </button>
    </form>
  );
}

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
