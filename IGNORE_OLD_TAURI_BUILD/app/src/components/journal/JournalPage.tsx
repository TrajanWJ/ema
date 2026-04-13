import { useEffect } from "react";
import { useJournalStore } from "@/stores/journal-store";
import { CalendarStrip } from "./CalendarStrip";
import { OneThingInput } from "./OneThingInput";
import { JournalEditor } from "./JournalEditor";
import { MoodPicker } from "./MoodPicker";
import { EnergyTracker } from "./EnergyTracker";

export function JournalPage() {
  const loadEntry = useJournalStore((s) => s.loadEntry);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  return (
    <div className="flex flex-col h-full">
      <CalendarStrip />
      <OneThingInput />

      <div className="flex flex-1 min-h-0 gap-4">
        {/* Main editor area */}
        <div className="flex-1 flex flex-col min-h-0">
          <JournalEditor />
        </div>

        {/* Sidebar: Mood + Energy */}
        <div className="w-48 shrink-0 flex flex-col gap-4">
          <MoodPicker />
          <EnergyTracker />
        </div>
      </div>
    </div>
  );
}
