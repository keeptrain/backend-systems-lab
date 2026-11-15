import { afterEach, describe, expect, it } from "bun:test";
import { type AnyElysia, Elysia } from "elysia";
import {
  blockDeviceId,
  type DeviceIdRateLimitOptions,
  deviceIdRateLimit,
  unblockDeviceId,
} from "../rate-limit";

let deviceSequence = 0;
const trackedDeviceIds = new Set<string>();

function nextDeviceId(prefix = "integration-device"): string {
  const deviceId = `${prefix}-${Date.now()}-${deviceSequence++}`;
  trackedDeviceIds.add(deviceId);
  return deviceId;
}

function createApp(options: DeviceIdRateLimitOptions = {}) {
  return new Elysia()
    .onRequest(deviceIdRateLimit(options))
    .get("/", () => "Hello Elysia")
    .get("/health", () => "Hello from health endpoint");
}

function createCountingApp(options: DeviceIdRateLimitOptions = {}) {
  let routeCalls = 0;
  const app = new Elysia()
    .onRequest(deviceIdRateLimit(options))
    .get("/", () => {
      routeCalls++;
      return "Hello Elysia";
    });

  return { app, routeCalls: () => routeCalls };
}

function request(
  app: AnyElysia,
  path = "/",
  deviceId?: string,
  headerName = "x-device-id",
): Promise<Response> {
  return app.handle(
    new Request(`http://localhost${path}`, {
      headers: deviceId === undefined ? undefined : { [headerName]: deviceId },
    }),
  );
}

afterEach(() => {
  for (const deviceId of trackedDeviceIds) unblockDeviceId(deviceId);
  trackedDeviceIds.clear();
});

describe("middleware/rate-limit integration test", () => {
  describe("success", () => {
    describe("GET /", () => {
      it("should return correct response", async () => {
        const response = await request(createApp());

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("Hello Elysia");
      });

      it("should return correct response with device id", async () => {
        const deviceId = nextDeviceId();
        const response = await request(createApp(), "/", deviceId);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("Hello Elysia");
      });

      it("should keep rate limit counters independent per device", async () => {
        const firstDeviceId = nextDeviceId();
        const secondDeviceId = nextDeviceId();
        const app = createApp({ maxRequests: 1, windowMs: 10_000 });

        const firstResponse = await request(app, "/", firstDeviceId);
        const secondResponse = await request(app, "/", secondDeviceId);
        const blockedResponse = await request(app, "/", firstDeviceId);

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(blockedResponse.status).toBe(429);
      });

      it("should allow requests without a device id", async () => {
        const app = createApp({ maxRequests: 1 });

        const firstResponse = await request(app);
        const secondResponse = await request(app);

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
      });

      it("should ignore a blank device id", async () => {
        const app = createApp({ maxRequests: 1 });

        const firstResponse = await request(app, "/", "   ");
        const secondResponse = await request(app, "/", "   ");

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
      });
    });

    describe("GET / with custom header", () => {
      it("should return correct response with custom header", async () => {
        const deviceId = nextDeviceId();
        const app = createApp({
          headerName: "x-custom-device-id",
          maxRequests: 1,
          windowMs: 10_000,
        });

        const firstResponse = await request(
          app,
          "/",
          deviceId,
          "x-custom-device-id",
        );
        const blockedResponse = await request(
          app,
          "/",
          deviceId,
          "x-custom-device-id",
        );

        expect(firstResponse.status).toBe(200);
        expect(blockedResponse.status).toBe(429);
      });
    });

    describe("GET /health", () => {
      it("should return correct response", async () => {
        const response = await request(createApp(), "/health");

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("Hello from health endpoint");
      });

      it("should return correct response with device id", async () => {
        const deviceId = nextDeviceId();
        const response = await request(createApp(), "/health", deviceId);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("Hello from health endpoint");
      });
    });
  });

  describe("VALIDATION GET /", () => {
    it("should return 429 when maxRequests is exceeded", async () => {
      const deviceId = nextDeviceId();
      const app = createApp({
        maxRequests: 2,
        windowMs: 10_000,
        blockMs: 5_000,
      });

      expect((await request(app, "/", deviceId)).status).toBe(200);
      expect((await request(app, "/", deviceId)).status).toBe(200);

      const response = await request(app, "/", deviceId);

      expect(response.status).toBe(429);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(response.headers.get("retry-after")).toBe("5");
      expect(await response.json()).toEqual({
        error: "Too many requests",
        retryAfter: 5,
      });
    });

    it("should return 429 for a device that is already blocked", async () => {
      const deviceId = nextDeviceId();
      blockDeviceId(deviceId, 4_500);

      const response = await request(createApp(), "/", deviceId);
      const retryAfter = Number(response.headers.get("retry-after"));

      expect(response.status).toBe(429);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(5);
    });

    it("should block every route for the device that exceeds the limit", async () => {
      const deviceId = nextDeviceId();
      const app = createApp({
        maxRequests: 1,
        windowMs: 10_000,
        blockMs: 1_000,
      });

      expect((await request(app, "/", deviceId)).status).toBe(200);
      expect((await request(app, "/", deviceId)).status).toBe(429);

      const healthResponse = await request(app, "/health", deviceId);

      expect(healthResponse.status).toBe(429);
    });

    it("should not call the route handler when the device is blocked", async () => {
      const deviceId = nextDeviceId();
      const { app, routeCalls } = createCountingApp({
        maxRequests: 1,
        windowMs: 10_000,
        blockMs: 1_000,
      });

      expect((await request(app, "/", deviceId)).status).toBe(200);
      expect((await request(app, "/", deviceId)).status).toBe(429);
      expect((await request(app, "/", deviceId)).status).toBe(429);

      expect(routeCalls()).toBe(1);
    });
  });
});
