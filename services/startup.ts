import { getDb, closeDb } from './persistence/db.js';
import { createPubSub, type PubSub } from './realtime/pubsub.js';
import { startHttpServer, stopHttpServer } from './http/server.js';
import { startWsServer, stopWsServer } from './realtime/server.js';
import { registerBrainDumpChannel } from './core/brain-dump/brain-dump.channel.js';
import { registerDashboardChannel } from './core/dashboard/dashboard.channel.js';
import { registerExecutionsChannel } from './core/executions/executions.channel.js';
import { registerProjectsChannel } from './core/projects/projects.channel.js';
import { registerSettingsChannel } from './core/settings/settings.channel.js';
import { registerTasksChannel } from './core/tasks/tasks.channel.js';
import { registerVoiceChannel } from './core/voice/voice.channel.js';
import { registerWorkspaceChannel } from './core/workspace/workspace.channel.js';
import { runIngestionBootstrap } from './core/ingestion/bootstrap.js';
import { runLoopMigrations } from './core/loop/migrations.js';
import { pipeBus } from './core/pipes/bus.js';

let pubsub: PubSub | undefined;
let bootstrapPromise: Promise<void> | null = null;

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

export async function startServices(): Promise<void> {
  log('Starting EMA services...');

  // 1. Database
  log('Database: connecting...');
  getDb();
  runLoopMigrations();
  log('Database: connected (WAL mode)');

  // 2. PubSub
  log('PubSub: starting...');
  pubsub = createPubSub();
  log('PubSub: started');

  // 3. HTTP server
  log('HTTP server: starting...');
  await startHttpServer();
  log('HTTP server: started on :4488');

  // 4. WebSocket server
  log('WebSocket server: starting...');
  startWsServer(pubsub);
  log('WebSocket server: started on /socket/websocket');

  // 5. Register channel handlers
  log('Channels: registering...');
  registerBrainDumpChannel();
  registerDashboardChannel();
  registerExecutionsChannel();
  registerProjectsChannel();
  registerSettingsChannel();
  registerTasksChannel();
  registerVoiceChannel();
  registerWorkspaceChannel();
  log('Channels: registered');

  try {
    pipeBus.trigger('system:daemon_started', {
      at: new Date().toISOString(),
    });
  } catch {
    // Boot must not fail if the pipe bus has no listeners yet.
  }

  if (shouldRunIngestionBootstrap()) {
    bootstrapPromise = Promise.resolve()
      .then(() => runIngestionBootstrap({
        repoRoot: process.cwd(),
      }))
      .then((result) => {
        const progress = result.backfill
          ? `backfill ${result.backfill.offset} -> ${result.backfill.next_offset ?? 'done'}`
          : 'backfill skipped';
        log(`Bootstrap: Chronicle anchored (${progress})`);
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : 'unknown_error';
        log(`Bootstrap: failed (${detail})`);
      });
  }

  log('All services started.');
}

export async function stopServices(): Promise<void> {
  log('Shutting down EMA services...');

  log('WebSocket server: closing...');
  stopWsServer();
  log('WebSocket server: closed');

  log('HTTP server: closing...');
  await stopHttpServer();
  log('HTTP server: closed');

  log('Database: closing...');
  if (bootstrapPromise) {
    await bootstrapPromise.catch(() => {});
    bootstrapPromise = null;
  }
  closeDb();
  log('Database: closed');

  log('Shutdown complete.');
}

function shouldRunIngestionBootstrap(): boolean {
  const flag = process.env.EMA_BOOTSTRAP_INGESTION?.trim().toLowerCase();
  return flag !== '0' && flag !== 'false';
}

function handleShutdownSignal(signal: string): void {
  log(`Received ${signal}, shutting down...`);
  stopServices()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('Error during shutdown:', err);
      process.exit(1);
    });
}

// Boot when run directly
const isMainModule =
  process.argv[1]?.endsWith('startup.ts') ||
  process.argv[1]?.endsWith('startup.js');

if (isMainModule) {
  process.on('SIGTERM', () => handleShutdownSignal('SIGTERM'));
  process.on('SIGINT', () => handleShutdownSignal('SIGINT'));

  startServices().catch((err: unknown) => {
    console.error('Failed to start services:', err);
    process.exit(1);
  });
}
