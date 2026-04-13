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
import { registerWorkspaceChannel } from './core/workspace/workspace.channel.js';
import { runLoopMigrations } from './core/loop/migrations.js';
import { pipeBus } from './core/pipes/bus.js';

let pubsub: PubSub | undefined;

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
  registerWorkspaceChannel();
  log('Channels: registered');

  try {
    pipeBus.trigger('system:daemon_started', {
      at: new Date().toISOString(),
    });
  } catch {
    // Boot must not fail if the pipe bus has no listeners yet.
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
  closeDb();
  log('Database: closed');

  log('Shutdown complete.');
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
