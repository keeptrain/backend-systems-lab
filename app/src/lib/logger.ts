import { hostname } from "node:os";
import pino from "pino";
import { ENV } from "../constants/env";

const isDevelopment = ENV.NODE_ENV === "development";

/**
 * In development, logs are piped through `pino-pretty` so they stay readable
 * in the terminal. pino-pretty is loaded with a dynamic import so production
 * runs (where it is not installed) never resolve the module. `pino.transport`
 * is avoided because it relies on worker threads, which fail under Bun.
 */
const destination = isDevelopment ? await createPrettyDestination() : undefined;

export const logger = pino(
  {
    level: ENV.LOG_LEVEL,
    base: {
      service: "backend-systems-lab",
      env: ENV.NODE_ENV,
      pid: process.pid,
      hostname: hostname(),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "headers.authorization",
        "headers.cookie",
      ],
      censor: "[REDACTED]",
    },
  },
  destination,
);

async function createPrettyDestination() {
  const { default: pretty } = await import("pino-pretty");

  return pretty({
    colorize: Boolean(process.stdout.isTTY),
    translateTime: "SYS:HH:MM:ss.l",
    ignore: "pid,hostname",
  });
}
