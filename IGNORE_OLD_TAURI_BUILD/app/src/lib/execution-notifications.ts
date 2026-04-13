import { joinChannel } from "@/lib/ws";
import { useNotificationStore } from "@/stores/notification-store";
import type { Execution } from "@/types/executions";

let subscribed = false;

export function subscribeExecutionNotifications(): void {
  if (subscribed) return;
  subscribed = true;

  joinChannel("executions:all")
    .then(({ channel }) => {
      channel.on("execution_completed", ({ execution }: { execution: Execution }) => {
        const label = execution.title || execution.intent_slug || "Execution";
        useNotificationStore.getState().push(
          `${execution.mode} completed: ${label}`,
          "success",
        );
      });

      channel.on("execution_updated", ({ execution }: { execution: Execution }) => {
        if (execution.status === "failed") {
          const label = execution.title || execution.intent_slug || "Execution";
          useNotificationStore.getState().push(
            `${execution.mode} failed: ${label}`,
            "error",
          );
        }
      });
    })
    .catch(() => {
      // Execution channel may already be joined by execution-store — that's fine
    });
}
