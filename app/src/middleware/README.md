# Rate Limit Layer 1

In-memory device ID rate limiter. First line of defense before any request hits
the route. Written because not every abuse problem needs Redis.

## What it does

Reads `x-device-id`, counts requests per device in a fixed window, and blocks
devices that exceed the limit. Blocked devices get a `429` until the block
expires.

Two caches live in memory:

- `blockedDeviceIds` — devices currently blocked, evicted by TTL.
- `requestCounts` — request count and window reset per device, evicted by TTL.

Both are capped at 100,000 entries so this layer can't grow forever.

## Why device ID instead of IP

IPs are shared behind NATs, proxies, and mobile carriers. Rate limiting by IP
punishes innocent users on the same network. Device ID is closer to a real
client, but it's sent by the client so it can be faked. Treat this as abuse
reduction, not a security boundary.

## Usage

```ts
import { Elysia } from "elysia";
import { deviceIdRateLimit } from "./middleware/rate-limit";

const app = new Elysia()
  .onRequest(deviceIdRateLimit())
  .get("/", () => "Hello Elysia");
```

With custom options:

```ts
.onRequest(
  deviceIdRateLimit({
    headerName: "x-device-id",
    windowMs: 60_000,
    maxRequests: 120,
    blockMs: 10 * 60_000,
  }),
)
```

Options:

| Option   | Default      |
| -------- | ------------ |
| headerName | `x-device-id` |
| windowMs   | `60_000`     |
| maxRequests | `60`        |
| blockMs    | `5 * 60_000` |

Blocked device:

```http
HTTP/1.1 429 Too Many Requests
content-type: application/json
retry-after: 300

{"error":"Too many requests","retryAfter":300}
```

Helpers:

```ts
import { blockDeviceId, isDeviceIdBlocked, unblockDeviceId } from "./middleware/rate-limit";

blockDeviceId("device-123", 15 * 60_000);
isDeviceIdBlocked("device-123"); // true
unblockDeviceId("device-123");
```

`blockDeviceId` also clears that device's request counter, so it starts fresh
after the block ends.

## Design choices

**`onRequest`, not `onBeforeHandle`.** Runs before routing, so blocked devices
never reach route matching or validation.

**LRU cache instead of Map/object.** Hard cap on memory; least recently used
entries evicted automatically.

**TTL instead of cron.** No extra cleanup job needed.

**Fixed window.** Cheap and simple. Trade-off: burst at window edges.

**Fail-open when no device ID.** Request without a header still goes through,
so legitimate clients don't break. It also means an attacker can skip this
layer by omitting the header — don't make this your only control.

## Trade-offs

Good for:

- Single-instance apps
- Cheap first line of defense before adding infrastructure
- Relaxed limits acceptable

Not good for:

- Multi-instance clusters (each process has its own counter)
- Persistent counters after restart
- Billing or contract quotas
- Environments where device ID can't be trusted

## Testing

Unit test calls handlers directly. Integration test runs through Elysia
`.handle()` without listening on a port.

```bash
bun test src/middleware/_test
```

30 tests: 18 unit, 12 integration.
