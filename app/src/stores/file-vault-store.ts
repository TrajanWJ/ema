import { create } from "zustand";
import { api } from "@/lib/api";

export interface VaultFile {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly mime_type: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface FileVaultState {
  files: readonly VaultFile[];
  selectedFileId: string | null;
  loading: boolean;
  error: string | null;
  loadFiles: () => Promise<void>;
  selectFile: (id: string | null) => void;
  uploadFile: (name: string, content: string, mime_type: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
}

export const useFileVaultStore = create<FileVaultState>((set) => ({
  files: [],
  selectedFileId: null,
  loading: false,
  error: null,

  async loadFiles() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ files: VaultFile[] }>("/file-vault/files");
      set({ files: data.files, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  selectFile(id) {
    set({ selectedFileId: id });
  },

  async uploadFile(name, content, mime_type) {
    const file = await api.post<VaultFile>("/file-vault/files", { name, content, mime_type });
    set((s) => ({ files: [file, ...s.files] }));
  },

  async deleteFile(id) {
    await api.delete(`/file-vault/files/${id}`);
    set((s) => ({
      files: s.files.filter((f) => f.id !== id),
      selectedFileId: s.selectedFileId === id ? null : s.selectedFileId,
    }));
  },
}));
