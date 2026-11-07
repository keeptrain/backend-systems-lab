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

export type Shutdown = (signal: string) => Promise<void>;

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
    log = (message) => console.log(message),
    error = (message, cause) => console.error(message, cause),
  } = options;

  let shuttingDown = false;

  return async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      log(`Received ${signal}, shutdown already in progress`);
      return;
    }

    shuttingDown = true;
    log(`Received ${signal}, starting graceful shutdown`);

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
      exit(0);
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
