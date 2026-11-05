# Rate Limit Layer 1

Rate limiter berbasis device ID di memori. Pertahanan awal sebelum request mencapai route. Ditulis karena tidak semua masalah abuse butuh Redis.

## Apa yang dilakukan

Membaca header `x-device-id`, menghitung request per device dalam satu window, dan memblokir device yang melewati batas. Device yang diblokir menerima `429` hingga waktu blokir habis.

Dua cache di memori:

- `blockedDeviceIds` — device yang sedang diblokir, dihapus otomatis lewat TTL.
- `requestCounts` — jumlah request dan waktu reset window per device, dihapus otomatis lewat TTL.

Kedua cache dibatasi 100.000 entri agar tidak makan memori tanpa batas.

## Kenapa device ID, bukan IP

IP sering dibagi banyak pengguna di kantor, kafe, dan jaringan seluler. Rate limit berdasarkan IP bisa menghukum pengguna tak bersalah di jaringan yang sama.

Device ID lebih dekat ke identitas client, tapi dikirim oleh client sehingga bisa dipalsukan. Pakai layer ini untuk mengurangi abuse, bukan sebagai kontrol keamanan yang ketat.

## Penggunaan

```ts
import { Elysia } from "elysia";
import { deviceIdRateLimit } from "./middleware/rate-limit";

const app = new Elysia()
  .onRequest(deviceIdRateLimit())
  .get("/", () => "Hello Elysia");
```

Dengan opsi:

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

| Opsi        | Default       |
| ----------- | ------------- |
| headerName  | `x-device-id` |
| windowMs    | `60_000`      |
| maxRequests | `60`          |
| blockMs     | `5 * 60_000`  |

Response saat kena batas:

```http
HTTP/1.1 429 Too Many Requests
content-type: application/json
retry-after: 300

{"error":"Too many requests","retryAfter":300}
```

Helper:

```ts
import { blockDeviceId, isDeviceIdBlocked, unblockDeviceId } from "./middleware/rate-limit";

blockDeviceId("device-123", 15 * 60_000);
isDeviceIdBlocked("device-123"); // true
unblockDeviceId("device-123");
```

`blockDeviceId` juga menghapus counter device, jadi setelah blokir selesai device mulai hitung dari nol.

## Keputusan desain

**`onRequest`, bukan `onBeforeHandle`.** Berjalan sebelum routing, jadi device yang diblokir tidak perlu melewati pencarian route dan validasi.

**LRU cache, bukan Map.** Memori terbatas; entri paling lama tidak dipakai dibuang otomatis.

**TTL, bukan cron.** Tidak ada job tambahan untuk membersihkan blokir yang sudah kadaluarsa.

**Fixed window.** Murah dan sederhana. Kompromi: burst di tepi window.

**Fail-open saat tidak ada device ID.** Request tanpa header tetap dilanjutkan supaya client sah tidak rusak. Efek sampingnya, penyerang bisa melewati layer ini dengan tidak mengirim header. Jangan jadikan ini satu-satunya kontrol.

## Kelebihan dan batasan

Cocok untuk:

- Aplikasi satu instance
- Pertahanan awal yang murah sebelum menambah infrastruktur
- Batas longgar masih bisa diterima

Tidak cocok untuk:

- Kluster multi-instance (tiap proses punya counter sendiri)
- Counter yang bertahan setelah restart
- Kuota billing atau kontrak
- Tempat di mana device ID tidak dipercaya

## Testing

Unit test memanggil handler secara langsung. Integration test melalui Elysia `.handle()` tanpa membuka port.

```bash
bun test src/middleware/_test
```

30 test: 18 unit, 12 integration.
