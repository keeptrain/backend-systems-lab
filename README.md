# Backend Systems Lab

Backend Systems Lab adalah proyek untuk mempelajari pembangunan backend service
yang siap dikembangkan dan dijalankan di production menggunakan Bun, Elysia,
dan TypeScript.

Fokus proyek ini adalah fondasi dan kebutuhan umum backend, seperti:

- HTTP server dan API;
- middleware;
- konfigurasi aplikasi;
- validation;
- rate limiting;
- logging dan observability;
- error handling;
- graceful shutdown;
- testing;
- containerization;
- CI/CD dan deployment.

Implementasi pada tiap topik dipisahkan ke dalam source code dan dokumentasi
masing-masing agar dapat dikembangkan secara bertahap tanpa mencampur domain
atau fitur yang belum diperlukan.

## Status

Saat ini proyek berisi fondasi HTTP service, health check, beberapa middleware,
logging, lifecycle handling, automated checks, serta konfigurasi build dan
deployment. Domain bisnis, database, autentikasi, dan API CRUD belum menjadi
fokus utama.

## Menjalankan secara lokal

Prasyarat: [Bun](https://bun.sh).

```bash
cd app
bun install
cp .env.example .env
bun run dev
```

Server berjalan di `http://localhost:3000`.

## Validasi

```bash
cd app
bun run lint
bun run typecheck
bun test src
```

## Teknologi

`Bun` · `Elysia` · `TypeScript` · `TypeBox` · `Pino` · `lru-cache` · `Docker` ·
`GitHub Actions` · `GHCR` · `Railway`
