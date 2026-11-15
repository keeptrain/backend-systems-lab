import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { ENV } from "../env";

const envFile = fileURLToPath(new URL("../env.ts", import.meta.url));

function loadEnv(overrides: Record<string, string> = {}) {
  const env = { ...process.env } as Record<string, string | undefined>;

  if (!("NODE_ENV" in overrides)) delete env.NODE_ENV;
  if (!("PORT" in overrides)) delete env.PORT;
  if (!("LOG_LEVEL" in overrides)) delete env.LOG_LEVEL;
  Object.assign(env, overrides);

  return Bun.spawnSync({
    cmd: [
      process.execPath,
      "-e",
      `import { ENV } from ${JSON.stringify(envFile)}; console.log(JSON.stringify(ENV));`,
    ],
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
}

function readEnv(output: Uint8Array): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(output));
}

describe("constants/env unit test", () => {
  describe("success", () => {
    it("should expose validated env", () => {
      expect(ENV.PORT).toBeGreaterThanOrEqual(1);
      expect(ENV.PORT).toBeLessThanOrEqual(65535);
      expect(typeof ENV.NODE_ENV).toBe("string");
      expect(typeof ENV.LOG_LEVEL).toBe("string");
    });

    it("should apply defaults when env is empty", () => {
      const result = loadEnv();

      expect(result.exitCode).toBe(0);
      expect(readEnv(result.stdout)).toEqual({
        NODE_ENV: "development",
        PORT: 3000,
        LOG_LEVEL: "debug",
      });
    });

    it("should coerce a valid port string", () => {
      const result = loadEnv({ NODE_ENV: "production", PORT: "8080" });

      expect(result.exitCode).toBe(0);
      expect(readEnv(result.stdout)).toEqual({
        NODE_ENV: "production",
        PORT: 8080,
        LOG_LEVEL: "info",
      });
    });

    it("should default log level to silent under test", () => {
      const result = loadEnv({ NODE_ENV: "test" });

      expect(result.exitCode).toBe(0);
      expect(readEnv(result.stdout)).toEqual({
        NODE_ENV: "test",
        PORT: 3000,
        LOG_LEVEL: "silent",
      });
    });

    it("should honor an explicit log level", () => {
      const result = loadEnv({ NODE_ENV: "production", LOG_LEVEL: "trace" });

      expect(result.exitCode).toBe(0);
      expect(readEnv(result.stdout)).toEqual({
        NODE_ENV: "production",
        PORT: 3000,
        LOG_LEVEL: "trace",
      });
    });
  });

  describe("validation", () => {
    it("should reject unsupported node env", () => {
      const result = loadEnv({ NODE_ENV: "staging" });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain(
        "NODE_ENV: Expected union value",
      );
    });

    it("should reject invalid port", () => {
      for (const port of ["abc", "65536", "3000.5"]) {
        const result = loadEnv({ PORT: port });

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr.toString()).toContain("PORT: Expected integer");
      }
    });

    it("should reject unsupported log level", () => {
      const result = loadEnv({ LOG_LEVEL: "verbose" });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain(
        "LOG_LEVEL: Expected union value",
      );
    });
  });
});
