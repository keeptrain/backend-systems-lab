import { mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import pino from "pino";
import { ENV } from "../constants/env";

const isDevelopment = ENV.NODE_ENV === "development";

/**
 * In development logs are appended to `logs/dev.log` as JSON lines, so the
 * terminal stays clean while every entry remains searchable. The path follows
 * the working directory, so `bun run dev` from `app/` writes
 * `app/logs/dev.log`. Production keeps writing to stdout because containers
 * collect it there.
 *
 * `pino.transport` is avoided because it relies on worker threads, which fail
 * under Bun.
 */
const devStreams = isDevelopment ? await createDevStreams() : undefined;

const options: pino.LoggerOptions = {
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
};

/** Application logs. In development they go to the file; warnings and errors
 * are also mirrored to the terminal. */
export const logger = pino(options, devDestination("warn"));

/**
 * Lifecycle logs (startup, shutdown) also mirror to the terminal in
 * development, so it is obvious when the server is up or stopping.
 */
export const lifecycleLogger = devStreams
  ? pino(options, devDestination("trace"))
  : logger;

function devDestination(terminalLevel: pino.Level) {
  if (!devStreams) return undefined;

  return pino.multistream([
    { level: "trace", stream: devStreams.file },
    { level: terminalLevel, stream: devStreams.terminal },
  ]);
}

async function createDevStreams() {
  const { default: pretty } = await import("pino-pretty");
  const logFile = join(process.cwd(), "logs", "dev.log");

  mkdirSync(dirname(logFile), { recursive: true });

  return {
    file: pino.destination({ dest: logFile, sync: true }),
    terminal: pretty({
      colorize: Boolean(process.stdout.isTTY),
      translateTime: "SYS:HH:MM:ss.l",
      ignore: "pid,hostname",
    }),
  };
}
