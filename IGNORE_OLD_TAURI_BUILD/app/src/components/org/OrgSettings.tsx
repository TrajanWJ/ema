import { useState } from "react";
import { useOrgStore } from "@/stores/org-store";
import type { Organization } from "@/types/org";

interface Props {
  org: Organization;
  onBack: () => void;
}

export function OrgSettings({ org, onBack }: Props) {
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState(org.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await useOrgStore.getState().updateOrg(org.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
      });
      onBack();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this organization? This cannot be undone.")) return;
    await useOrgStore.getState().deleteOrg(org.id);
    useOrgStore.getState().setActiveOrg(null);
    onBack();
  }

  return (
    <div className="space-y-4">
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
          Settings
        </h2>
      </div>

      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.75rem] outline-none"
          style={{ color: "var(--pn-text-primary)" }}
        />
      </div>

      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.75rem] outline-none resize-none"
          style={{ color: "var(--pn-text-primary)" }}
          rows={3}
        />
      </div>

      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Avatar URL</label>
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.75rem] outline-none font-mono"
          style={{ color: "var(--pn-text-primary)" }}
          placeholder="https://..."
        />
      </div>

      <div className="flex items-center gap-2 text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
        <span>Slug:</span>
        <code>{org.slug}</code>
        <span>(cannot be changed)</span>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full text-[0.75rem] py-2 rounded font-medium transition-all disabled:opacity-40"
        style={{ background: "rgba(45, 212, 168, 0.15)", color: "#2dd4a8" }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      {/* Danger zone */}
      <div className="pt-4 border-t" style={{ borderColor: "var(--pn-border-subtle)" }}>
        <button
          onClick={() => setShowDanger(!showDanger)}
          className="text-[0.65rem] font-medium"
          style={{ color: "#ef4444" }}
        >
          {showDanger ? "Hide" : "Danger Zone"}
        </button>

        {showDanger && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.06)" }}>
            <p className="text-[0.65rem] mb-2" style={{ color: "var(--pn-text-secondary)" }}>
              Deleting this organization removes all members and data. This cannot be undone.
            </p>
            <button
              onClick={handleDelete}
              className="text-[0.7rem] px-3 py-1.5 rounded font-medium"
              style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
            >
              Delete Organization
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
