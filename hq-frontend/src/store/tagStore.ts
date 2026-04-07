import { create } from "zustand";
import type { Tag } from "../api/hq";
import * as hq from "../api/hq";

export type { Tag };

interface TagStore {
  tags: Tag[];
  loading: boolean;

  loadTags: (params?: { entity_type?: string; entity_id?: string; actor_id?: string }) => Promise<void>;
  addTag: (data: { entity_type: string; entity_id: string; tag: string; actor_id?: string; namespace?: string }) => Promise<void>;
  removeTag: (params: { entity_type: string; entity_id: string; tag: string; actor_id?: string }) => Promise<void>;
  getTagsForEntity: (entityType: string, entityId: string) => Tag[];
}

export const useTagStore = create<TagStore>((set, get) => ({
  tags: [],
  loading: false,

  async loadTags(params) {
    set({ loading: true });
    try {
      const data = await hq.getTags(params);
      set({ tags: data.tags, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async addTag(data) {
    const tag = await hq.createTag(data);
    set((state) => ({ tags: [tag, ...state.tags] }));
  },

  async removeTag(params) {
    await hq.deleteTag(params);
    set((state) => ({
      tags: state.tags.filter(
        (t) =>
          !(
            t.entity_type === params.entity_type &&
            t.entity_id === params.entity_id &&
            t.tag === params.tag
          )
      ),
    }));
  },

  getTagsForEntity(entityType, entityId) {
    return get().tags.filter(
      (t) => t.entity_type === entityType && t.entity_id === entityId
    );
  },
}));
