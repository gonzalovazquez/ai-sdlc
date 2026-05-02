import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { MemorySaver } from "@langchain/langgraph";
import { logger } from "../logger";

const log = logger.child({ module: "checkpointer" });

let _checkpointer: PostgresSaver | MemorySaver | null = null;
let _setupPromise: Promise<void> | null = null;

/**
 * Returns a checkpointer instance. PostgreSQL-backed if DATABASE_URL is set,
 * otherwise in-memory for local dev.
 *
 * PostgresSaver.setup() is called once to create the required tables
 * (checkpoints, checkpoint_blobs, checkpoint_writes, checkpoint_migrations).
 */
export function getCheckpointer(): PostgresSaver | MemorySaver {
  if (_checkpointer) return _checkpointer;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const saver = PostgresSaver.fromConnString(databaseUrl);
    _checkpointer = saver;

    // Run setup() once to create tables — fire-and-forget on first call,
    // but callers can await ensureSetup() if they need it done first.
    _setupPromise = saver.setup().catch((err) => {
      log.error({ err }, "Failed to set up PostgresSaver tables");
      throw err;
    });

    return saver;
  }

  log.warn("DATABASE_URL not set — using in-memory checkpointer. State will not persist across restarts.");
  _checkpointer = new MemorySaver();
  return _checkpointer;
}

/**
 * Await this to guarantee the Postgres schema is ready before first use.
 * No-op if using MemorySaver.
 */
export async function ensureCheckpointerReady(): Promise<void> {
  if (!_checkpointer) getCheckpointer();
  if (_setupPromise) await _setupPromise;
}
