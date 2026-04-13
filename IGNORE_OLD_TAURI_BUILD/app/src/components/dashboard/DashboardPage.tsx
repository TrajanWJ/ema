import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { OneThingCard } from "./OneThingCard";
import { HabitsSummaryCard } from "./HabitsSummaryCard";
import { BrainDumpCard } from "./BrainDumpCard";
import { MoodEnergyCard } from "./MoodEnergyCard";
import { JournalPreviewCard } from "./JournalPreviewCard";
import { QuickLinksCard } from "./QuickLinksCard";

type Page = "dashboard" | "brain-dump" | "habits" | "journal" | "settings";

interface DashboardPageProps {
  readonly onNavigate: (page: Page) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const addCapture = useBrainDumpStore((s) => s.add);

  function handleCapture() {
    const text = window.prompt("Quick capture:");
    if (text?.trim()) addCapture(text.trim());
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-min">
      <div className="lg:col-span-3">
        <OneThingCard />
      </div>
      <HabitsSummaryCard onNavigate={() => onNavigate("habits")} />
      <BrainDumpCard onNavigate={() => onNavigate("brain-dump")} />
      <MoodEnergyCard />
      <div className="md:col-span-2">
        <JournalPreviewCard onNavigate={() => onNavigate("journal")} />
      </div>
      <QuickLinksCard onNavigate={onNavigate} onCapture={handleCapture} />
    </div>
  );
}
