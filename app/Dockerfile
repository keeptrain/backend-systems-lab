FROM oven/bun:1.4.4 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src

RUN bun run build:linux-x64

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/server-linux-x64 ./server

ENV NODE_ENV=production
EXPOSE 3000
USER 10001:10001

CMD ["./server"]
