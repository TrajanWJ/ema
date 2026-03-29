import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { BrainDumpPage } from "@/components/brain-dump/BrainDumpPage";

type Page = "dashboard" | "brain-dump" | "habits" | "journal" | "settings";

function Placeholder({ name }: { readonly name: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <span className="text-[0.8rem]" style={{ color: "var(--pn-text-tertiary)" }}>
        {name}
      </span>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <Shell activePage={page} onNavigate={setPage}>
      {page === "dashboard" && <DashboardPage onNavigate={setPage} />}
      {page === "brain-dump" && <BrainDumpPage />}
      {page === "habits" && <Placeholder name="Habits" />}
      {page === "journal" && <Placeholder name="Journal" />}
      {page === "settings" && <Placeholder name="Settings" />}
    </Shell>
  );
}
