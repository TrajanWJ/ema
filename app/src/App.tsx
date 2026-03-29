import { Shell } from "@/components/layout/Shell";
import { Launchpad } from "@/components/layout/Launchpad";
import { BrainDumpApp } from "@/components/brain-dump/BrainDumpApp";
import { HabitsApp } from "@/components/habits/HabitsApp";
import { JournalApp } from "@/components/journal/JournalApp";
import { SettingsApp } from "@/components/settings/SettingsApp";

function getRoute(): string {
  return window.location.pathname.replace(/^\/+/, "") || "launchpad";
}

export default function App() {
  const route = getRoute();

  switch (route) {
    case "brain-dump":
      return <BrainDumpApp />;
    case "habits":
      return <HabitsApp />;
    case "journal":
      return <JournalApp />;
    case "settings":
      return <SettingsApp />;
    default:
      return (
        <Shell>
          <Launchpad />
        </Shell>
      );
  }
}
