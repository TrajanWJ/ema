import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { BrainDumpPage } from "@/components/brain-dump/BrainDumpPage";
import { HabitsPage } from "@/components/habits/HabitsPage";
import { JournalPage } from "@/components/journal/JournalPage";
import { SettingsPage } from "@/components/settings/SettingsPage";

type Page = "dashboard" | "brain-dump" | "habits" | "journal" | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <Shell activePage={page} onNavigate={setPage}>
      {page === "dashboard" && <DashboardPage onNavigate={setPage} />}
      {page === "brain-dump" && <BrainDumpPage />}
      {page === "habits" && <HabitsPage />}
      {page === "journal" && <JournalPage />}
      {page === "settings" && <SettingsPage />}
    </Shell>
  );
}
