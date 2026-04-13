import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_PORT = 4488;

export const DB_PATH = join(homedir(), ".local/share/ema/ema.db");

export const VAULT_PATH = join(homedir(), ".local/share/ema/vault/");

export const WS_PATH = "/socket/websocket";

export const API_PREFIX = "/api";
