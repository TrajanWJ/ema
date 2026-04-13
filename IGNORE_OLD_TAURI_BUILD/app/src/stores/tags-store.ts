import { create } from "zustand";
import { api } from "@/lib/api";
import type { Tag } from "@/types/actors";

interface TagsState {
  tags: Record<string, Tag[]>;
  loading: boolean;
  loadForEntity: (entityType: string, entityId: string) => Promise<void>;
  addTag: (
    entityType: string,
    entityId: string,
    tag: string,
    actorId: string,
    namespace: string,
  ) => Promise<void>;
  removeTag: (
    entityType: string,
    entityId: string,
    tag: string,
    actorId: string,
  ) => Promise<void>;
}

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export const useTagsStore = create<TagsState>((set) => ({
  tags: {},
  loading: false,

  async loadForEntity(entityType, entityId) {
    set({ loading: true });
    try {
      const data = await api.get<{ tags: Tag[] }>(
        `/tags?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
      );
      const key = entityKey(entityType, entityId);
      set((state) => ({
        tags: { ...state.tags, [key]: data.tags },
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  async addTag(entityType, entityId, tag, actorId, namespace) {
    const created = await api.post<{ tag: Tag }>("/tags", {
      entity_type: entityType,
      entity_id: entityId,
      tag,
      actor_id: actorId,
      namespace,
    });
    const key = entityKey(entityType, entityId);
    set((state) => ({
      tags: {
        ...state.tags,
        [key]: [...(state.tags[key] ?? []), created.tag],
      },
    }));
  },

  async removeTag(entityType, entityId, tag, actorId) {
    await api.delete(
      `/tags?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}&tag=${encodeURIComponent(tag)}&actor_id=${encodeURIComponent(actorId)}`,
    );
    const key = entityKey(entityType, entityId);
    set((state) => ({
      tags: {
        ...state.tags,
        [key]: (state.tags[key] ?? []).filter(
          (t) => !(t.tag === tag && t.actor_id === actorId),
        ),
      },
    }));
  },
}));
