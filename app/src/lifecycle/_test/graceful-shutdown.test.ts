import { describe, expect, it } from "bun:test";
import {
  createGracefulShutdown,
  type GracefulShutdownOptions,
} from "../graceful-shutdown";

function makeShutdown(
  stop: () => Promise<unknown>,
  options: GracefulShutdownOptions = {},
) {
  const exits: number[] = [];
  const logs: string[] = [];
  const errors: string[] = [];

  const shutdown = createGracefulShutdown(
    { stop },
    {
      timeoutMs: 1000,
      exit: (code) => exits.push(code),
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
      ...options,
    },
  );

  return { shutdown, exits, logs, errors };
}

describe("lifecycle/graceful-shutdown unit test", () => {
  describe("success", () => {
    it("should stop the server and exit with zero", async () => {
      const { shutdown, exits, logs } = makeShutdown(async () => {});

      await shutdown("SIGTERM");

      expect(exits).toEqual([0]);
      expect(logs).toContain("Received SIGTERM, starting graceful shutdown");
      expect(logs).toContain("Server stopped, exiting");
    });

    it("should ignore duplicate signals", async () => {
      let stopCalls = 0;
      const { shutdown, exits } = makeShutdown(async () => {
        stopCalls++;
      });

      await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);

      expect(stopCalls).toBe(1);
      expect(exits).toEqual([0]);
    });
  });

  describe("failure", () => {
    it("should exit with one when stop fails", async () => {
      const { shutdown, exits, errors } = makeShutdown(async () => {
        throw new Error("stop failed");
      });

      await shutdown("SIGTERM");

      expect(exits).toEqual([1]);
      expect(errors).toContain("Failed to stop server cleanly");
    });

    it("should force exit when stop exceeds the timeout", async () => {
      const { shutdown, exits, errors } = makeShutdown(
        () => new Promise(() => {}),
        { timeoutMs: 20 },
      );

      void shutdown("SIGTERM");
      await Bun.sleep(50);

      expect(exits).toEqual([1]);
      expect(errors).toContain("Graceful shutdown exceeded 20ms, forcing exit");
    });
  });
});
