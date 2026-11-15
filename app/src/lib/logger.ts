import { mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { ENV } from "../constants/env";

const isDevelopment = ENV.NODE_ENV === "development";

/**
 * In development logs are appended to `logs/dev.log` as JSON lines, so the
 * terminal stays clean while every entry remains searchable. Production keeps
 * writing to stdout because containers collect it there.
 *
 * `pino.transport` is avoided because it relies on worker threads, which fail
 * under Bun.
 */
const destination = isDevelopment ? createFileDestination() : undefined;

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

function createFileDestination() {
  const logFile =
    ENV.LOG_FILE ??
    fileURLToPath(new URL("../../logs/dev.log", import.meta.url));

  mkdirSync(dirname(logFile), { recursive: true });

  return pino.destination({ dest: logFile, sync: false });
}
