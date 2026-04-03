import { create } from "zustand";
import { api } from "@/lib/api";

export interface ManagedFile {
  readonly id: string;
  readonly filename: string;
  readonly path: string;
  readonly size_bytes: number;
  readonly mime_type: string;
  readonly tags: readonly string[];
  readonly project_id: string | null;
  readonly uploaded_at: string;
  readonly inserted_at: string;
}

interface FileVaultState {
  files: readonly ManagedFile[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  createFile: (data: {
    filename: string;
    path: string;
    mime_type: string;
    project_id?: string;
    tags?: string[];
  }) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
}

export const useFileVaultStore = create<FileVaultState>((set) => ({
  files: [],
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ files: ManagedFile[] }>("/file-vault");
      set({ files: data.files, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createFile(payload) {
    try {
      const data = await api.post<{ file: ManagedFile }>("/file-vault", payload);
      set((s) => ({ files: [data.file, ...s.files] }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  async deleteFile(id) {
    try {
      await api.delete(`/file-vault/${id}`);
      set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
