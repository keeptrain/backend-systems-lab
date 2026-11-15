import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const loggerFile = fileURLToPath(new URL("../logger.ts", import.meta.url));

function runLogger(source: string, overrides: Record<string, string> = {}) {
  const env = { ...process.env } as Record<string, string | undefined>;
  delete env.NODE_ENV;
  delete env.LOG_LEVEL;
  delete env.LOG_FILE;
  Object.assign(env, overrides);

  return Bun.spawnSync({
    cmd: [
      process.execPath,
      "-e",
      `import { logger, lifecycleLogger } from ${JSON.stringify(loggerFile)};${source};logger.flush?.();lifecycleLogger.flush?.();`,
    ],
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
}

function readLines(output: Uint8Array): Record<string, unknown>[] {
  return new TextDecoder()
    .decode(output)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe("lib/logger unit test", () => {
  describe("success", () => {
    it("should emit JSON with a string level and base fields", () => {
      const result = runLogger('logger.info({ port: 3000 }, "started")', {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
      });

      expect(result.exitCode).toBe(0);

      const [entry] = readLines(result.stdout);

      expect(entry).toMatchObject({
        level: "info",
        service: "backend-systems-lab",
        env: "production",
        port: 3000,
        msg: "started",
      });
      expect(typeof entry?.time).toBe("string");
    });

    it("should redact sensitive headers", () => {
      const result = runLogger(
        'logger.warn({ headers: { authorization: "Bearer token", cookie: "session=abc" } }, "request")',
        { NODE_ENV: "production", LOG_LEVEL: "info" },
      );

      expect(result.exitCode).toBe(0);

      const [entry] = readLines(result.stdout);

      expect(entry?.headers).toEqual({
        authorization: "[REDACTED]",
        cookie: "[REDACTED]",
      });
    });

    it("should respect the configured log level", () => {
      const result = runLogger('logger.debug("hidden")', {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
      });

      expect(result.exitCode).toBe(0);
      expect(readLines(result.stdout)).toEqual([]);
    });

    it("should append JSON lines to a log file in development", () => {
      const dir = mkdtempSync(join(tmpdir(), "logger-test-"));
      const logFile = join(dir, "dev.log");

      const result = runLogger('logger.info({ port: 3000 }, "started")', {
        NODE_ENV: "development",
        LOG_LEVEL: "info",
        LOG_FILE: logFile,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toBe("");

      const [entry] = readLines(new Uint8Array(readFileSync(logFile)));

      expect(entry).toMatchObject({
        level: "info",
        env: "development",
        service: "backend-systems-lab",
        port: 3000,
        msg: "started",
      });

      rmSync(dir, { recursive: true, force: true });
    });

    it("should mirror lifecycle logs to terminal and file in development", () => {
      const dir = mkdtempSync(join(tmpdir(), "logger-test-"));
      const logFile = join(dir, "dev.log");

      const result = runLogger(
        'logger.info("regular"); lifecycleLogger.info({ port: 3000 }, "started")',
        {
          NODE_ENV: "development",
          LOG_LEVEL: "info",
          LOG_FILE: logFile,
        },
      );

      expect(result.exitCode).toBe(0);

      const msgs = readLines(new Uint8Array(readFileSync(logFile))).map(
        (entry) => entry.msg,
      );

      expect(msgs).toEqual(["regular", "started"]);

      const output = result.stdout.toString();

      expect(output).toContain("started");
      expect(output).not.toContain("regular");

      rmSync(dir, { recursive: true, force: true });
    });
  });
});
