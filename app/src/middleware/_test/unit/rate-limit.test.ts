import { afterEach, describe, expect, it } from "bun:test";
import {
  blockDeviceId,
  deviceIdRateLimit,
  isDeviceIdBlocked,
  unblockDeviceId,
} from "../../rate-limit";

type RateLimitHandler = ReturnType<typeof deviceIdRateLimit>;

let deviceSequence = 0;
const trackedDeviceIds = new Set<string>();

function nextDeviceId(prefix = "device"): string {
  const deviceId = `${prefix}-${Date.now()}-${deviceSequence++}`;
  trackedDeviceIds.add(deviceId);
  return deviceId;
}

function makeRequest(deviceId?: string, headerName = "x-device-id"): Request {
  const headers = new Headers();
  if (deviceId !== undefined) headers.set(headerName, deviceId);
  return new Request("http://localhost/test", { headers });
}

function run(
  handler: RateLimitHandler,
  deviceId?: string,
  headerName = "x-device-id",
): Response | undefined {
  return handler({ request: makeRequest(deviceId, headerName) });
}

function expectRateLimited(response: Response | undefined): Response {
  expect(response).toBeInstanceOf(Response);
  if (!response) throw new Error("Expected a rate limit response");
  return response;
}

afterEach(() => {
  for (const deviceId of trackedDeviceIds) unblockDeviceId(deviceId);
  trackedDeviceIds.clear();
});

describe("middleware/rate-limit unit test", () => {
  describe("success", () => {
    describe("isDeviceIdBlocked", () => {
      it("should return false for a device that is not blocked", () => {
        expect(isDeviceIdBlocked(nextDeviceId())).toBe(false);
      });

      it("should return true after a device is blocked", () => {
        const deviceId = nextDeviceId();
        blockDeviceId(deviceId, 1_000);

        expect(isDeviceIdBlocked(deviceId)).toBe(true);
      });

      it("should return false after the block duration expires", async () => {
        const deviceId = nextDeviceId();
        blockDeviceId(deviceId, 25);
        await Bun.sleep(60);

        expect(isDeviceIdBlocked(deviceId)).toBe(false);
      });
    });

    describe("blockDeviceId", () => {
      it("should block a device with the default duration", () => {
        const deviceId = nextDeviceId();
        blockDeviceId(deviceId);

        expect(isDeviceIdBlocked(deviceId)).toBe(true);
      });

      it("should reset the request counter for the device", async () => {
        const deviceId = nextDeviceId();
        const handler = deviceIdRateLimit({ maxRequests: 1, blockMs: 25 });

        expect(run(handler, deviceId)).toBeUndefined();
        blockDeviceId(deviceId, 25);
        await Bun.sleep(60);

        expect(run(handler, deviceId)).toBeUndefined();
      });
    });

    describe("unblockDeviceId", () => {
      it("should remove an active block", () => {
        const deviceId = nextDeviceId();
        blockDeviceId(deviceId, 1_000);
        unblockDeviceId(deviceId);

        expect(isDeviceIdBlocked(deviceId)).toBe(false);
      });

      it("should reset the request counter for the device", () => {
        const deviceId = nextDeviceId();
        const handler = deviceIdRateLimit({ maxRequests: 1, windowMs: 10_000 });

        expect(run(handler, deviceId)).toBeUndefined();
        unblockDeviceId(deviceId);

        expect(run(handler, deviceId)).toBeUndefined();
      });
    });

    describe("deviceIdRateLimit", () => {
      it("should allow requests up to maxRequests", () => {
        const deviceId = nextDeviceId();
        const handler = deviceIdRateLimit({ maxRequests: 3, windowMs: 10_000 });

        expect(run(handler, deviceId)).toBeUndefined();
        expect(run(handler, deviceId)).toBeUndefined();
        expect(run(handler, deviceId)).toBeUndefined();
      });

      it("should track devices independently", () => {
        const firstDeviceId = nextDeviceId();
        const secondDeviceId = nextDeviceId();
        const handler = deviceIdRateLimit({ maxRequests: 1, windowMs: 10_000 });

        expect(run(handler, firstDeviceId)).toBeUndefined();
        expect(run(handler, secondDeviceId)).toBeUndefined();
      });

      it("should reset the counter after the window expires", async () => {
        const deviceId = nextDeviceId();
        const handler = deviceIdRateLimit({ maxRequests: 2, windowMs: 30 });

        expect(run(handler, deviceId)).toBeUndefined();
        expect(run(handler, deviceId)).toBeUndefined();
        await Bun.sleep(60);

        expect(run(handler, deviceId)).toBeUndefined();
        expect(run(handler, deviceId)).toBeUndefined();
      });

      it("should read the device id from a custom header", () => {
        const deviceId = nextDeviceId();
        const handler = deviceIdRateLimit({
          headerName: "x-custom-device-id",
          maxRequests: 1,
          windowMs: 10_000,
        });

        expect(run(handler, deviceId, "x-custom-device-id")).toBeUndefined();
        expect(
          expectRateLimited(run(handler, deviceId, "x-custom-device-id"))
            .status,
        ).toBe(429);
      });

      it("should trim whitespace from the device id", () => {
        const deviceId = nextDeviceId();
        const handler = deviceIdRateLimit({ maxRequests: 1, windowMs: 10_000 });

        expect(run(handler, `  ${deviceId}  `)).toBeUndefined();
        expect(expectRateLimited(run(handler, deviceId)).status).toBe(429);
      });

      it("should allow requests without a device id", () => {
        const handler = deviceIdRateLimit({ maxRequests: 1 });

        expect(run(handler)).toBeUndefined();
        expect(run(handler)).toBeUndefined();
      });

      it("should allow requests again after the block expires", async () => {
        const deviceId = nextDeviceId();
        const handler = deviceIdRateLimit({
          maxRequests: 1,
          windowMs: 10_000,
          blockMs: 25,
        });

        expect(run(handler, deviceId)).toBeUndefined();
        expect(expectRateLimited(run(handler, deviceId)).status).toBe(429);
        await Bun.sleep(60);

        expect(run(handler, deviceId)).toBeUndefined();
      });
    });
  });

  describe("VALIDATION deviceIdRateLimit", () => {
    it("should return 429 when maxRequests is exceeded", async () => {
      const deviceId = nextDeviceId();
      const handler = deviceIdRateLimit({
        maxRequests: 2,
        windowMs: 10_000,
        blockMs: 5_000,
      });

      expect(run(handler, deviceId)).toBeUndefined();
      expect(run(handler, deviceId)).toBeUndefined();

      const response = expectRateLimited(run(handler, deviceId));
      expect(response.status).toBe(429);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(response.headers.get("retry-after")).toBe("5");
      expect(await response.json()).toEqual({
        error: "Too many requests",
        retryAfter: 5,
      });
    });

    it("should block the device after maxRequests is exceeded", () => {
      const deviceId = nextDeviceId();
      const handler = deviceIdRateLimit({
        maxRequests: 1,
        windowMs: 10_000,
        blockMs: 1_000,
      });

      expect(run(handler, deviceId)).toBeUndefined();
      expect(expectRateLimited(run(handler, deviceId)).status).toBe(429);

      expect(isDeviceIdBlocked(deviceId)).toBe(true);
    });

    it("should return 429 for a device that is already blocked", () => {
      const deviceId = nextDeviceId();
      blockDeviceId(deviceId, 4_500);

      const response = expectRateLimited(run(deviceIdRateLimit(), deviceId));
      const retryAfter = Number(response.headers.get("retry-after"));

      expect(response.status).toBe(429);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(5);
    });

    it("should ignore a blank device id", () => {
      const handler = deviceIdRateLimit({ maxRequests: 1 });

      expect(run(handler, "   ")).toBeUndefined();
      expect(run(handler, "   ")).toBeUndefined();
    });
  });
});
