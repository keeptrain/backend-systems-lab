import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { ENV } from "../env";

const envFile = fileURLToPath(new URL("../env.ts", import.meta.url));

function loadEnv(overrides: Record<string, string> = {}) {
  const env = { ...process.env } as Record<string, string | undefined>;

  if (!("NODE_ENV" in overrides)) delete env.NODE_ENV;
  if (!("PORT" in overrides)) delete env.PORT;
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
    });

    it("should apply defaults when env is empty", () => {
      const result = loadEnv();

      expect(result.exitCode).toBe(0);
      expect(readEnv(result.stdout)).toEqual({
        NODE_ENV: "development",
        PORT: 3000,
      });
    });

    it("should coerce a valid port string", () => {
      const result = loadEnv({ NODE_ENV: "production", PORT: "8080" });

      expect(result.exitCode).toBe(0);
      expect(readEnv(result.stdout)).toEqual({
        NODE_ENV: "production",
        PORT: 8080,
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
  });
});
