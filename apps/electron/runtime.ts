import { app } from "electron";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HEALTH_URL = "http://127.0.0.1:4488/api/health";

let servicesProcess: ChildProcess | null = null;
let workersProcess: ChildProcess | null = null;

function isExternalRuntime(): boolean {
  return process.env.EMA_MANAGED_RUNTIME === "external";
}

function repoRoot(): string {
  return path.resolve(__dirname, "../../..");
}

function runtimeRoot(): string {
  return app.isPackaged ? process.resourcesPath : repoRoot();
}

function resolveRuntimeScript(packageName: "services" | "workers"): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, packageName, "startup.js");
  }

  return path.join(repoRoot(), packageName, "dist", "startup.js");
}

function spawnNodeProcess(scriptPath: string): ChildProcess {
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Runtime entrypoint not found: ${scriptPath}`);
  }

  return spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
    },
    cwd: runtimeRoot(),
    stdio: app.isPackaged ? "pipe" : "inherit",
  });
}

async function terminateChildProcess(child: ChildProcess): Promise<void> {
  if (child.killed || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }

  child.kill("SIGTERM");

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 3_000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function waitForHealth(timeoutMs = 15_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(HEALTH_URL, {
        signal: AbortSignal.timeout(1_000),
      });

      if (response.ok) {
        return;
      }
    } catch {
      // Runtime not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error("Timed out waiting for local EMA services");
}

export async function startManagedRuntime(): Promise<void> {
  if (isExternalRuntime()) {
    return;
  }

  if (!servicesProcess) {
    servicesProcess = spawnNodeProcess(resolveRuntimeScript("services"));
  }

  if (!workersProcess) {
    workersProcess = spawnNodeProcess(resolveRuntimeScript("workers"));
  }

  await waitForHealth();
}

export async function stopManagedRuntime(): Promise<void> {
  for (const child of [workersProcess, servicesProcess]) {
    if (child) {
      await terminateChildProcess(child);
    }
  }

  workersProcess = null;
  servicesProcess = null;
}
