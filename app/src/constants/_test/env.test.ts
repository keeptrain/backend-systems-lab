import { describe, expect, it } from "bun:test";
import { ENV, parseEnv } from "../env";

describe("constants/env unit test", () => {
  describe("success", () => {
    it("should use defaults when env is empty", () => {
      expect(parseEnv({})).toEqual({
        NODE_ENV: "development",
        PORT: 3000,
      });
    });

    it("should convert port string into a number", () => {
      expect(parseEnv({ PORT: "8080" })).toEqual({
        NODE_ENV: "development",
        PORT: 8080,
      });
    });

    it("should accept every supported node env", () => {
      for (const nodeEnv of ["development", "test", "production"] as const) {
        expect(parseEnv({ NODE_ENV: nodeEnv }).NODE_ENV).toBe(nodeEnv);
      }
    });

    it("should expose validated env", () => {
      expect(ENV.PORT).toBeGreaterThanOrEqual(1);
      expect(ENV.PORT).toBeLessThanOrEqual(65535);
      expect(typeof ENV.NODE_ENV).toBe("string");
    });
  });

  describe("validation", () => {
    it("should reject unsupported node env", () => {
      expect(() => parseEnv({ NODE_ENV: "staging" })).toThrow(
        "NODE_ENV: Expected union value",
      );
    });

    it("should reject non-numeric port", () => {
      expect(() => parseEnv({ PORT: "abc" })).toThrow(
        "PORT: Expected integer",
      );
    });

    it("should reject port below one", () => {
      expect(() => parseEnv({ PORT: "0" })).toThrow(
        "PORT: Expected integer to be greater or equal to 1",
      );
    });

    it("should reject port above 65535", () => {
      expect(() => parseEnv({ PORT: "65536" })).toThrow(
        "PORT: Expected integer to be less or equal to 65535",
      );
    });

    it("should reject decimal port", () => {
      expect(() => parseEnv({ PORT: "3000.5" })).toThrow(
        "PORT: Expected integer",
      );
    });
  });
});
