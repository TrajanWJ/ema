import { create } from "zustand";
import { api } from "@/lib/api";

export interface InvoiceLineItem {
  readonly description: string;
  readonly amount: number;
}

export interface Invoice {
  readonly id: string;
  readonly number: string;
  readonly contact_id: string | null;
  readonly client_name: string | null;
  readonly project_id: string | null;
  readonly items: readonly InvoiceLineItem[];
  readonly subtotal: number;
  readonly tax: number;
  readonly total: number;
  readonly status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  readonly due_date: string;
  readonly paid_at: string | null;
  readonly notes: string | null;
  readonly inserted_at: string;
}

interface InvoiceState {
  invoices: readonly Invoice[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  createInvoice: (attrs: {
    contact_id?: string;
    client_id?: string;
    due_date: string;
    notes?: string;
    items: { description: string; amount: number }[];
  }) => Promise<void>;
  updateInvoice: (
    id: string,
    attrs: Partial<Omit<Invoice, "id" | "inserted_at">>,
  ) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  sendInvoice: (id: string) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ invoices: Invoice[] }>("/invoices");
      set({ invoices: data.invoices, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createInvoice(attrs) {
    await api.post<{ invoice: Invoice }>("/invoices", { invoice: attrs });
    await useInvoiceStore.getState().loadViaRest();
  },

  async updateInvoice(id, attrs) {
    await api.put<{ invoice: Invoice }>(`/invoices/${id}`, {
      invoice: attrs,
    });
    await useInvoiceStore.getState().loadViaRest();
  },

  async deleteInvoice(id) {
    await api.delete(`/invoices/${id}`);
    set((s) => ({
      invoices: s.invoices.filter((inv) => inv.id !== id),
    }));
  },

  async sendInvoice(id) {
    await api.post(`/invoices/${id}/send`, {});
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === id ? { ...inv, status: "sent" as const } : inv,
      ),
    }));
  },

  async markPaid(id) {
    await api.post(`/invoices/${id}/mark-paid`, {});
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === id ? { ...inv, status: "paid" as const } : inv,
      ),
    }));
  },
}));
