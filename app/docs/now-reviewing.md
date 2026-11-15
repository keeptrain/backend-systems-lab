# Review: Hal yang Perlu Diperhatikan sebelum Production

Proyek ini memiliki beberapa aspek fundamental yang harus dipahami sebelum
dideploy atau digunakan di produksi. Kebanyakan adalah "pitfall" yang mudah
terlewat sampai error muncul.

---

## 1. Validasi Environment Jalankan Saat Import

`src/constants/env.ts` adalah IIFE ( Immediately Invoked Function Expression )
yang dieksekusi saat module di-impor — ini terjadi sebelum `new Elysia()` di
`src/index.js`.

- Jika ada variable environment tidak valid, proses ** berhenti sebelum app
  mulai**. Anda akan melihat pesan error yang menyebut variable-nya:

  ```text
  Invalid environment variables:
  - PORT: Expected integer to be greater or equal to 1
  ```

- Variable yang valid: `NODE_ENV` (`development`/`test`/`production`) dan
  `PORT` (integer `1..65535`). Nilai lain akan membatalkan start.

- Default digunakan saat variable kosong atau tidak ada:
  - `NODE_ENV` → `development`
  - `PORT` → `3000`

---

## 2. Konversi PORT (dan Apa yang Ditolak)

`PORT` melalui dua tahap:

1. `Number(port)` — mengubah string menjadi number. String non-integer seperti
   `"3000.5"` menjadi `Number.NaN`, lalu gagal validasi TypeBox.
2. `t.Integer({ minimum: 1, maximum: 65535 }) — menolak di luar rentang
   valid.

**Nilai yang ditolak** (proses keluar):

| Nilai | Alasan |
|---|---|
| `"abc"` | Bukan integer |
| `"0"` | Di bawah minimum `1` |
| `"65536"` | Di atas maksimum `65535` |
| `"3000.5"` | `Number("3000.5")` → `NaN`, bukan integer |
| `null` / `undefined` | Kembali ke default `3000` |

**Nilai yang diterima**:

| Nilai | Hasil |
|---|---|
| `undefined` / tidak ada | Default `3000` |
| `"8080"` | `8080` (number) |
| `3000` | `3000` (sudah number) |

---

## 3. `NODE_ENV` Hanyalah Union Literal

Hanya diterima tiga nilai: `"development"`, `"test"`, `"production"`.
String lain (termasuk `"Staging"`, `"prod"`, `""`) memicu error
`NODE_ENV: Expected union value`.

Default `"development"` saat variable tidak di-set atau kosong.

---

## 4. Kapasitas Cache (Layer Rate-Limiter)

Middleware rate-limit menggunakan dua LRU cache, setiap satuan maksimal **100.000 entry**:

| Cache | Tujuan |
|---|---|
| `blockedDeviceIds` | Device yang sedang diblokir, dibuang lewat TTL |
| `requestCounts` | Counter request + waktu reset per device, dibuang lewat TTL |

**Dampak memori** (diukur di Bun 1.4.4 setelah GC):

| Entri | Heap | RSS |
|---|---|---|
| 0 | 5.7 MB | 31 MB |
| 100k counter | 19.4 MB | 71 MB |
| +100k blocked | 32.0 MB | 88 MB |

**Aturan jari**:

- Container **256 MB RAM**: 100k per cache aman.
- Container **128 MB RAM**: pertimbangkan kurangi ke 25k–50k per cache, atau
  naikkan memory container.
- 100k adalah **batas memori, bukan batas keamanan**. Lebih dari 100k ID unik
  akan menyebabkan LRU mewawancarai, bisa menghapus device yang diblokir.

---

## 5. Apa yang Tersisa di Memori Setelah Startup

Konstant `ENV` dihitung sekali saat import module. Setelah itu:

- Skema TypeBox hidup hanya di dalam IIFE dan tidak dipertahankan.
- `ENV.PORT` dan `ENV.NODE_ENV` adalah nilai plain (`number` dan `string`).
- Validasi tidak terjadi di runtime setelah startup — kalau mengubah env var,
  harus merestart proses untuk mengambil nilai baru.

---

## 6. Mismatch Versi Biome Config

Repo ini menyedia `biome.json` schema `2.6.5`, tetapi CLI Biome yang terinstal
mungkin `2.6.4`. Ini **hanya informasi**, bukan error:

```
i The configuration schema version does not match the CLI version 2.6.4
```

Bisa diabaikan, atau jalankan `bunx biome migrate` untuk memperbarui file.

---

## 7. Struktur Test

- Unit test di `src/<module>/_test/unit/`.
- Integration test di `src/<module>/_test/`.
- Jalankan hanya test env: `bun test src/constants/_test/env.test.ts`.
- Jalankan test middleware: `bun test src/middleware/_test`.
- Full suite (saat ini): 30 test (18 unit + 12 integration), semua lulus.

---

## 8. Menjalankan Aplikasi

```bash
# Development (auto-reload saat berubah)
bun run dev

# Only type-check
bun run typecheck

# Only lint
bun run lint
```

---

## 9. Catatan Deployment

- Aplikasi membaca `.env` otomatis melalui Bun (butuh `dotenv` tidak).
- `.env` **sekalipun tidak pernah di-commit**; hanya `.env.example` yang di-track.
- Railway inject `PORT` otomatis; `NODE_ENV` default ke `production` di image Docker.
- Kalau menambah variable env ke schema, juga perbarui:
  - Skema TypeBox di `src/constants/env.ts`
  - Tabel README di bawah "Environment variables"
  - File test jika butuh coverage

---