# Reviewing: Things to Note Before Running / Deploying

This project has a few basic-but-critical behaviors you should be aware of before
starting the server or deploying. Most of these are "gotchas" that are easy to
overlook until you see the error.

---

## 1. Environment Validation Happens at Import Time

`src/constants/env.ts` is an **immediately invoked IIFE** that runs when the module
is first imported (which happens before `new Elysia()` in `src/index.ts`).

- If any environment variable is invalid, the process **exits before the app
  starts**. You will see a stack trace like:

  ```text
  Invalid environment variables:
  - PORT: Expected integer to be greater or equal to 1
  ```

- Valid variables are: `NODE_ENV` (`development`/`test`/`production`) and
  `PORT` (integer `1..65535`). Any other value stops the process.

- Defaults apply when the variable is empty or missing:
  - `NODE_ENV` → `development`
  - `PORT` → `3000`

---

## 2. How `PORT` is Coerced (and What Fails)

`PORT` goes through two steps:

1. `Number(port)` — converts the string to a number. Non-integer strings like
   `"3000.5"` become `Number.NaN`, which then fails TypeBox validation.
2. `t.Integer({ minimum: 1, maximum: 65535 })` — rejects anything outside the
   valid port range.

**Rejected values** (process exits):

| Value | Reason |
|---|---|
| `"abc"` | Not an integer |
| `"0"` | Below minimum `1` |
| `"65536"` | Above maximum `65535` |
| `"3000.5"` | `Number("3000.5")` → `NaN`, not an integer |
| `null` / `undefined` | Falls back to default `3000` |

**Accepted values**:

| Value | Result |
|---|---|
| `undefined` / missing | Default `3000` |
| `"8080"` | `8080` (number) |
| `3000` | `3000` (already a number) |

---

## 3. `NODE_ENV` is a Literal Union

Only three values are accepted: `"development"`, `"test"`, `"production"`.
Any other string (including `"Staging"`, `"prod"`, `""`) triggers the
validation error `NODE_ENV: Expected union value`.

The default is `"development"` when the variable is not set or is empty.

---

## 4. Cache Capacity (Rate-Limit Layer)

The rate-limiter middleware uses two LRU caches, each capped at **100,000 entries**:

| Cache | Purpose |
|---|---|
| `blockedDeviceIds` | Devices currently blocked, evicted by TTL |
| `requestCounts` | Request count + window reset per device, evicted by TTL |

**Memory impact** (measured on Bun 1.4.4 after GC):

| Entries | Heap | RSS |
|---|---|---|
| 0 | 5.7 MB | 31 MB |
| 100k counters | 19.4 MB | 71 MB |
| +100k blocked | 32.0 MB | 88 MB |

**Rule of thumb**:

- Container **256 MB** RAM: 100k per cache is safe.
- Container **128 MB** RAM: consider reducing to 25k–50k per cache, or increase
  container memory.
- 100k is a **memory cap**, not a security cap. More than 100k unique IDs will
  cause LRU eviction, potentially removing blocked devices.

---

## 5. What Stays in Memory After Startup

The `ENV` constant is computed once at module import. After that:

- The TypeBox schema lives only inside the IIFE and is not retained.
- `ENV.PORT` and `ENV.NODE_ENV` are plain values (`number` and `string`).
- No runtime validation happens after startup — if you change env vars and
  restart, the new values will be read.

---

## 6. Biome Config Version Mismatch

The repo ships with `biome.json` schema `2.6.5`, but the installed Biome CLI
may be `2.6.4`. This is **informational only**, not an error:

```
i The configuration schema version does not match the CLI version 2.6.5
```

You can ignore it, or run `bunx biome migrate` to update the file.

---

## 7. Test Structure

- Unit tests live under `src/<module>/_test/unit/`.
- Integration tests live under `src/<module>/_test/`.
- To run only the env tests: `bun test src/constants/_test/env.test.ts`.
- To run middleware tests: `bun test src/middleware/_test`.
- Full suite (currently): 30 tests (18 unit + 12 integration), all passing.

---

## 8. Running the App

```bash
# Development (auto-reload on change)
bun run dev

# Type-check only
bun run typecheck

# Lint only
bun run lint
```

---

## 9. Deployment Notes

- The app reads `.env` automatically via Bun (no `dotenv` needed).
- `.env` itself must **never** be committed; only `.env.example` is tracked.
- Railway injects `PORT` automatically; `NODE_ENV` defaults to `production`
  in the Docker image.
- If you add new env vars to the schema, remember to also update:
  - The TypeBox schema in `src/constants/env.ts`
  - The README table under "Environment variables"
  - The test file if you want coverage

---