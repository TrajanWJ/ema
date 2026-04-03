import { useEffect, useState } from "react";
import { useInvoiceStore } from "@/stores/invoice-store";
import type { Invoice } from "@/stores/invoice-store";

const card = {
  background: "rgba(14,16,23,0.55)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
} as const;

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--pn-text-primary)",
  width: "100%",
  outline: "none",
  fontSize: 13,
} as const;

const btnPrimary = {
  background: "#2DD4A8",
  color: "#000",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
} as const;

const STATUS_COLORS: Record<Invoice["status"], string> = {
  draft: "#888",
  sent: "#6B95F0",
  paid: "#2DD4A8",
  overdue: "#f87171",
  cancelled: "#888",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

interface LineItemDraft {
  description: string;
  amount: string;
}

function emptyLineItem(): LineItemDraft {
  return { description: "", amount: "" };
}

export function InvoiceBillingApp() {
  const {
    invoices,
    loading,
    error,
    loadViaRest,
    createInvoice,
    sendInvoice,
    markPaid,
    deleteInvoice,
  } = useInvoiceStore();

  const [showForm, setShowForm] = useState(false);
  const [formContactId, setFormContactId] = useState("");
  const [formDueDate, setFormDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<LineItemDraft[]>([
    emptyLineItem(),
  ]);

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  const updateLineItem = (
    index: number,
    field: keyof LineItemDraft,
    value: string,
  ) => {
    setFormItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addLineItem = () =>
    setFormItems((prev) => [...prev, emptyLineItem()]);

  const removeLineItem = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const computedTotal = formItems.reduce((sum, item) => {
    const amt = parseFloat(item.amount) || 0;
    return sum + amt;
  }, 0);

  const handleCreate = async () => {
    const items = formItems
      .filter((li) => li.description.trim() && li.amount)
      .map((li) => ({
        description: li.description.trim(),
        amount: parseFloat(li.amount) || 0,
      }));
    if (items.length === 0) return;
    try {
      await createInvoice({
        contact_id: formContactId.trim() || undefined,
        due_date: formDueDate,
        notes: formNotes.trim() || undefined,
        items,
      });
      setFormItems([emptyLineItem()]);
      setFormContactId("");
      setFormNotes("");
      setShowForm(false);
    } catch (err) {
      console.warn("Failed to create invoice:", err);
    }
  };

  if (loading && invoices.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "var(--pn-text-secondary)", fontSize: 13 }}>
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            color: "var(--pn-text-primary)",
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Invoices
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: showForm
              ? "rgba(239,68,68,0.12)"
              : "rgba(107,149,240,0.12)",
            color: showForm ? "#ef4444" : "#6B95F0",
          }}
        >
          {showForm ? "Cancel" : "+ New Invoice"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <div style={card}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <input
              value={formContactId}
              onChange={(e) => setFormContactId(e.target.value)}
              placeholder="Contact ID"
              style={inputStyle}
            />
            <input
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              type="date"
              style={inputStyle}
            />
          </div>
          <textarea
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Notes"
            rows={2}
            style={{ ...inputStyle, marginBottom: 12, resize: "vertical" }}
          />

          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 12,
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            Line Items
          </div>
          {formItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr auto",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                value={item.description}
                onChange={(e) =>
                  updateLineItem(idx, "description", e.target.value)
                }
                placeholder="Description"
                style={inputStyle}
              />
              <input
                value={item.amount}
                onChange={(e) =>
                  updateLineItem(idx, "amount", e.target.value)
                }
                placeholder="Amount"
                type="number"
                step="0.01"
                style={inputStyle}
              />
              <button
                onClick={() => removeLineItem(idx)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f87171",
                  cursor: "pointer",
                  fontSize: 16,
                  padding: "0 4px",
                }}
              >
                x
              </button>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <button
              onClick={addLineItem}
              style={{
                background: "none",
                border: "none",
                color: "#6B95F0",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              + Add Line Item
            </button>
            <span
              style={{
                color: "var(--pn-text-primary)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Total: {formatCurrency(computedTotal)}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={handleCreate} style={btnPrimary}>
              Create Invoice
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {invoices.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No invoices yet
          </div>
        )}
        {invoices.map((inv) => (
          <div key={inv.id} style={{ ...card, marginBottom: 0, padding: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      color: "var(--pn-text-primary)",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {formatCurrency(inv.total)}
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${STATUS_COLORS[inv.status]}20`,
                      color: STATUS_COLORS[inv.status],
                    }}
                  >
                    {inv.status}
                  </span>
                </div>
                <div
                  style={{
                    color: "var(--pn-text-secondary)",
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  Due {new Date(inv.due_date).toLocaleDateString()}
                  {inv.contact_id ? ` \u00B7 Contact: ${inv.contact_id}` : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {inv.status === "draft" && (
                <button
                  onClick={() => sendInvoice(inv.id)}
                  style={{
                    background: "rgba(107,149,240,0.12)",
                    color: "#6B95F0",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  Send
                </button>
              )}
              {inv.status === "sent" && (
                <button
                  onClick={() => markPaid(inv.id)}
                  style={{
                    background: "rgba(45,212,168,0.12)",
                    color: "#2DD4A8",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  Mark Paid
                </button>
              )}
              <button
                onClick={() => deleteInvoice(inv.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f87171",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
