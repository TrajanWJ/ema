import { create } from "zustand";
import { api } from "@/lib/api";

interface IngestJob {
  id: number;
  source_type: "url" | "file" | "text" | "clipboard";
  source_uri: string;
  status: "pending" | "processing" | "done" | "failed";
  extracted_title: string | null;
  extracted_summary: string | null;
  extracted_tags: readonly string[];
  vault_path: string | null;
  inserted_at: string;
}

interface IngestorState {
  jobs: readonly IngestJob[];
  loading: boolean;
  selectedJob: IngestJob | null;

  loadJobs: () => Promise<void>;
  createJob: (source_type: string, source_uri: string) => Promise<void>;
  selectJob: (job: IngestJob | null) => void;
}

export const useIngestorStore = create<IngestorState>((set, get) => ({
  jobs: [],
  loading: false,
  selectedJob: null,

  async loadJobs() {
    set({ loading: true });
    try {
      const res = await api.get<{ data: IngestJob[] }>("/ingest-jobs");
      set({ jobs: res.data ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async createJob(source_type, source_uri) {
    try {
      await api.post("/ingest-jobs", {
        ingest_job: { source_type, source_uri },
      });
      get().loadJobs();
    } catch {
      /* swallow — loadJobs will show current state */
    }
  },

  selectJob(job) {
    set({ selectedJob: job });
  },
}));
