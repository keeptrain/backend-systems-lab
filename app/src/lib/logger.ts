import { hostname } from "node:os";
import pino from "pino";
import { ENV } from "../constants/env";

export const logger = pino({
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
});
