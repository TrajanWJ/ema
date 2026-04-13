import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { useFinanceStore } from "@/stores/finance-store";

const config = APP_CONFIGS["finance-tracker"];

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

const TYPE_COLORS = {
  income: "#2DD4A8",
  expense: "#f87171",
} as const;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function FinanceTrackerApp() {
  const {
    transactions,
    summary,
    loading,
    error,
    loadViaRest,
    createTransaction,
    deleteTransaction,
  } = useFinanceStore();

  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<"income" | "expense" | "all">(
    "all",
  );
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<"income" | "expense">("expense");
  const [formCategory, setFormCategory] = useState("");
  const [formDate, setFormDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  const filtered = transactions.filter(
    (tx) => filterType === "all" || tx.type === filterType,
  );

  const handleCreate = async () => {
    const amount = parseFloat(formAmount);
    if (!formDescription.trim() || isNaN(amount)) return;
    try {
      await createTransaction({
        description: formDescription.trim(),
        amount,
        type: formType,
        category: formCategory.trim() || "Uncategorized",
        date: formDate,
      });
      setFormDescription("");
      setFormAmount("");
      setFormCategory("");
      setShowForm(false);
    } catch (err) {
      console.warn("Failed to create transaction:", err);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <AppWindowChrome appId="finance-tracker" title={config.title} icon={config.icon} accent={config.accent}>
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
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="finance-tracker" title={config.title} icon={config.icon} accent={config.accent}>
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
          Finance
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
          {showForm ? "Cancel" : "+ Transaction"}
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

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={card}>
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 11,
              marginBottom: 4,
            }}
          >
            Income
          </div>
          <div style={{ color: "#2DD4A8", fontSize: 18, fontWeight: 700 }}>
            {summary ? formatCurrency(summary.total_income) : "$0.00"}
          </div>
        </div>
        <div style={card}>
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 11,
              marginBottom: 4,
            }}
          >
            Expenses
          </div>
          <div style={{ color: "#f87171", fontSize: 18, fontWeight: 700 }}>
            {summary ? formatCurrency(summary.total_expense) : "$0.00"}
          </div>
        </div>
        <div style={card}>
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 11,
              marginBottom: 4,
            }}
          >
            Net
          </div>
          <div style={{ color: "#6B95F0", fontSize: 18, fontWeight: 700 }}>
            {summary ? formatCurrency(summary.net) : "$0.00"}
          </div>
        </div>
      </div>

      {showForm && (
        <div style={card}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Description *"
              style={inputStyle}
            />
            <input
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="Amount *"
              type="number"
              step="0.01"
              style={inputStyle}
            />
            <select
              value={formType}
              onChange={(e) =>
                setFormType(e.target.value as "income" | "expense")
              }
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              placeholder="Category"
              style={inputStyle}
            />
            <input
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              type="date"
              style={inputStyle}
            />
          </div>
          <button onClick={handleCreate} style={btnPrimary}>
            Add Transaction
          </button>
        </div>
      )}

      {/* Filter by type */}
      <div style={{ marginBottom: 12 }}>
        <select
          value={filterType}
          onChange={(e) =>
            setFilterType(e.target.value as "income" | "expense" | "all")
          }
          style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
        >
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No transactions yet
          </div>
        )}
        {filtered.map((tx) => (
          <div
            key={tx.id}
            style={{
              ...card,
              marginBottom: 0,
              padding: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    color: "var(--pn-text-primary)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {tx.description}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    background: `${TYPE_COLORS[tx.type]}20`,
                    color: TYPE_COLORS[tx.type],
                  }}
                >
                  {tx.type}
                </span>
              </div>
              <div
                style={{
                  color: "var(--pn-text-secondary)",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {tx.category} &middot;{" "}
                {new Date(tx.date).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  color: TYPE_COLORS[tx.type],
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {tx.type === "expense" ? "-" : "+"}
                {formatCurrency(Math.abs(tx.amount))}
              </span>
              <button
                onClick={() => deleteTransaction(tx.id)}
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
    </AppWindowChrome>
  );
}
