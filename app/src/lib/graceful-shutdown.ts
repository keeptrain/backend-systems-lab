import type { EventEmitter } from "node:events";
import { lifecycleLogger } from "./logger";

export interface GracefulShutdownOptions {
  /** Maximum time to wait for in-flight requests before forcing exit. */
  timeoutMs?: number;
  /** Injectable exit function, useful for tests. */
  exit?: (code: number) => void;
  /** Lifecycle logger. */
  log?: (message: string) => void;
  /** Error logger. */
  error?: (message: string, cause?: unknown) => void;
}

export type Shutdown = (
  reason: string,
  options?: { exitCode?: number },
) => Promise<void>;

export interface FatalErrorOptions {
  /** Reporter for fatal errors. Defaults to the lifecycle logger. */
  fatal?: (message: string, cause: unknown) => void;
  /** Event source, injectable for tests. Defaults to `process`. */
  target?: Pick<EventEmitter, "on">;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Build a shutdown function that stops the server, waits for in-flight
 * requests, and exits. The timeout prevents a stuck request from blocking
 * the process forever.
 */
export function createGracefulShutdown(
  app: { stop(): Promise<unknown> },
  options: GracefulShutdownOptions = {},
): Shutdown {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    exit = (code) => process.exit(code),
    log = (message) => lifecycleLogger.info(message),
    error = (message, cause) => {
      if (cause === undefined) {
        lifecycleLogger.error(message);
        return;
      }

      lifecycleLogger.error({ err: cause }, message);
    },
  } = options;

  let shuttingDown = false;

  return async function shutdown(
    reason: string,
    { exitCode = 0 }: { exitCode?: number } = {},
  ): Promise<void> {
    if (shuttingDown) {
      log(`Shutdown already in progress, ignoring ${reason}`);
      return;
    }

    shuttingDown = true;
    log(`Starting graceful shutdown (${reason})`);

    const timeout = setTimeout(() => {
      error(`Graceful shutdown exceeded ${timeoutMs}ms, forcing exit`);
      exit(1);
    }, timeoutMs);

    try {
      // Elysia's Bun adapter calls server.stop(false): it stops accepting new
      // connections and resolves after in-flight requests finish.
      await app.stop();
      clearTimeout(timeout);
      log("Server stopped, exiting");
      exit(exitCode);
    } catch (cause) {
      clearTimeout(timeout);
      error("Failed to stop server cleanly", cause);
      exit(1);
    }
  };
}

/** Register `SIGTERM` and `SIGINT` handlers for the given shutdown function. */
export function listenForShutdownSignals(shutdown: Shutdown): void {
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

/**
 * Log fatal errors and run the same graceful shutdown, exiting with code 1.
 * Without this, an uncaught exception or rejected promise kills the process
 * before in-flight requests finish, and nothing reaches the log file.
 */
export function listenForFatalErrors(
  shutdown: Shutdown,
  options: FatalErrorOptions = {},
): void {
  const {
    fatal = (message, cause) => lifecycleLogger.fatal({ err: cause }, message),
    target = process,
  } = options;

  target.on("uncaughtException", (error) => {
    fatal("Uncaught exception", error);
    void shutdown("uncaughtException", { exitCode: 1 });
  });

  target.on("unhandledRejection", (reason) => {
    fatal("Unhandled rejection", reason);
    void shutdown("unhandledRejection", { exitCode: 1 });
  });
}
