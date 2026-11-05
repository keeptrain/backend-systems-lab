import { LRUCache } from "lru-cache";

/** Layer 1 */

const DEFAULT_HEADER_NAME = "x-device-id";
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_BLOCK_MS = 5 * 60_000;

const MAX_TRACKED_DEVICES = 100_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Devices that are currently blocked. The TTL of each entry is the remaining
 * block duration, so lru-cache evicts devices automatically once the block
 * expires.
 */
const blockedDeviceIds = new LRUCache<string, number>({
  max: MAX_TRACKED_DEVICES,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

/** Request counters per device for the current rate-limit window. */
const requestCounts = new LRUCache<string, RateLimitEntry>({
  max: MAX_TRACKED_DEVICES,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

export interface DeviceIdRateLimitOptions {
  /** Header that carries the device id. Default: `x-device-id`. */
  headerName?: string;
  /** Length of the counting window in milliseconds. Default: 60 seconds. */
  windowMs?: number;
  /** Maximum requests allowed per device in one window. Default: 60. */
  maxRequests?: number;
  /** How long a device stays blocked after exceeding the limit. Default: 5 minutes. */
  blockMs?: number;
}

/** Check whether a device is currently blocked. */
export function isDeviceIdBlocked(deviceId: string): boolean {
  return blockedDeviceIds.getRemainingTTL(deviceId) > 0;
}

/**
 * Block a device for `blockMs` milliseconds. Useful when another layer
 * detects abuse and wants to hand the device over to Layer 1.
 */
export function blockDeviceId(
  deviceId: string,
  blockMs = DEFAULT_BLOCK_MS,
): void {
  blockedDeviceIds.set(deviceId, Date.now() + blockMs, { ttl: blockMs });
  requestCounts.delete(deviceId);
}

/** Remove a device from the blocklist immediately. */
export function unblockDeviceId(deviceId: string): void {
  blockedDeviceIds.delete(deviceId);
  requestCounts.delete(deviceId);
}

function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}

/**
 * Elysia `onBeforeHandle` middleware that rate limits requests per device id
 * and blocks devices that exceed the limit.
 *
 * @example
 * app.onBeforeHandle(deviceIdRateLimit({ maxRequests: 100 }));
 */
export function deviceIdRateLimit(options: DeviceIdRateLimitOptions = {}) {
  const {
    headerName = DEFAULT_HEADER_NAME,
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    blockMs = DEFAULT_BLOCK_MS,
  } = options;

  return function rateLimitHandler({
    request,
  }: {
    request: Request;
  }): Response | undefined {
    const deviceId = request.headers.get(headerName)?.trim();
    if (!deviceId) return;

    const remainingBlockMs = blockedDeviceIds.getRemainingTTL(deviceId);
    if (remainingBlockMs > 0) {
      return tooManyRequests(Math.ceil(remainingBlockMs / 1000));
    }

    const now = Date.now();
    const current = requestCounts.get(deviceId);

    if (!current || current.resetAt <= now) {
      requestCounts.set(
        deviceId,
        { count: 1, resetAt: now + windowMs },
        { ttl: windowMs },
      );
      return;
    }

    const count = current.count + 1;
    if (count > maxRequests) {
      blockDeviceId(deviceId, blockMs);
      return tooManyRequests(Math.ceil(blockMs / 1000));
    }

    requestCounts.set(
      deviceId,
      { count, resetAt: current.resetAt },
      { ttl: current.resetAt - now },
    );
  };
}
