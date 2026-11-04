# Elysia with Bun runtime

## Getting Started

```bash
bun create elysia ./elysia-example
```

## Development

```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

## Environment variables

The app reads variables from `process.env` (Bun loads `app/.env` automatically).
Copy the template for local development:

```bash
cp .env.example .env
```

| Variable     | Required | Default                    | Description                                                       |
| ------------ | -------- | -------------------------- | ----------------------------------------------------------------- |
| `PORT`       | No       | `3000`                     | HTTP port. Railway injects this automatically at runtime.         |
| `NODE_ENV`   | No       | `production` (Dockerfile)  | Runtime mode. Already set by the image, override only if needed.  |

Never commit `.env`; only `.env.example` is tracked.

## Railway

The Railway service pulls the prebuilt image from GHCR:

```
ghcr.io/keeptrain/backend-systems-lab:latest
```

Configure the service once:

1. **Source** → **Docker Image** → the image above.
2. If the GHCR package is private, add **Registry Credentials** with a GitHub
   PAT that has `read:packages`.
3. **Variables** → Railway sets `PORT` automatically; `NODE_ENV` is optional
   because the image already defaults to `production`.

## CI/CD

Every push to `main` runs:

1. `.github/workflows/ci.yaml` — install, lint (Biome), build the linux x64
   binary, and run a smoke test.
2. `.github/workflows/docker.yaml` — starts only after CI succeeds, builds and
   pushes the image to GHCR, then triggers a Railway redeploy.

GitHub Actions configuration (not app runtime variables):

| Name             | Kind     | Description                                        |
| ---------------- | -------- | -------------------------------------------------- |
| `RAILWAY_TOKEN`  | secret   | Railway project token used by `railway redeploy`.  |
| `RAILWAY_SERVICE`| variable | Railway service name to redeploy.                  |
| `GITHUB_TOKEN`   | built-in | Used to authenticate to GHCR.                      |

If `RAILWAY_TOKEN` or `RAILWAY_SERVICE` is missing, the redeploy step is
skipped and the image is still pushed to GHCR.
