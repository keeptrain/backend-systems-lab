import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import {
  createGracefulShutdown,
  type GracefulShutdownOptions,
  listenForFatalErrors,
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

describe("graceful-shutdown unit test", () => {
  describe("success", () => {
    it("should stop the server and exit with zero", async () => {
      const { shutdown, exits, logs } = makeShutdown(async () => {});

      await shutdown("SIGTERM");

      expect(exits).toEqual([0]);
      expect(logs).toContain("Starting graceful shutdown (SIGTERM)");
      expect(logs).toContain("Server stopped, exiting");
    });

    it("should exit with the provided exit code", async () => {
      const { shutdown, exits, logs } = makeShutdown(async () => {});

      await shutdown("uncaughtException", { exitCode: 1 });

      expect(exits).toEqual([1]);
      expect(logs).toContain("Starting graceful shutdown (uncaughtException)");
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

  describe("fatal errors", () => {
    function register() {
      const calls: { reason: string; exitCode?: number }[] = [];
      const reports: [string, unknown][] = [];
      const target = new EventEmitter();

      listenForFatalErrors(
        async (reason, options) => {
          calls.push({ reason, exitCode: options?.exitCode });
        },
        {
          fatal: (message, cause) => reports.push([message, cause]),
          target,
        },
      );

      return { calls, reports, target };
    }

    it("should log and shut down on an uncaught exception", () => {
      const { calls, reports, target } = register();
      const error = new Error("boom");

      target.emit("uncaughtException", error);

      expect(reports).toEqual([["Uncaught exception", error]]);
      expect(calls).toEqual([{ reason: "uncaughtException", exitCode: 1 }]);
    });

    it("should log and shut down on an unhandled rejection", () => {
      const { calls, reports, target } = register();

      target.emit("unhandledRejection", "rejected");

      expect(reports).toEqual([["Unhandled rejection", "rejected"]]);
      expect(calls).toEqual([{ reason: "unhandledRejection", exitCode: 1 }]);
    });
  });
});
