# Implement Graceful Shutdown

## Apa itu graceful shutdown

Graceful shutdown adalah proses mematikan aplikasi secara terkontrol sehingga
request yang sedang diproses dapat selesai sebelum proses benar-benar berhenti.
Tujuannya adalah menghindari memutus koneksi tiba-tiba kepada client yang masih
aktif dan mencegah data tengah diproses hilang secara paksa.

## Mengapa penting untuk aplikasi ini

Aplikasi ini menggunakan runtime Bun dengan framework Elysia. Saat menerima
sinyal berhenti dari sistem operasi (seperti `SIGTERM` atau `SIGINT` dari
command line, atau dari orchestrator seperti Railway/Kubernetes saat
restart/deploy), aplikasi harus:

1. Menghentikan penerimaan request baru secepat mungkin.
2. Menunggu request yang sedang diproses selesai sampai batas waktu tertentu.
3. Menutup koneksi jaringan dan sumber daya secara rapi.
4. Keluar dengan kode keluar yang sesuai.

Tanpa graceful shutdown, proses dapat dibunuh seketika saat menerima sinyal
berhenti, sehingga client yang sedang menerima respons akan mengalami koneksi
terputus, dan transaksi atau operasi sedang berjalan dapat gagal setengah jalan.

## Alur shutdown yang diinginkan

Saat sinyal berhenti diterima, aplikasi seharusnya melewati tahap-tahap berikut
secara berurutan:

- **Terima sinyal** — Sistem mengirim `SIGTERM` (atau `SIGINT` saat `Ctrl+C`).
- **Stop menerima request baru** — Server berhenti mendengarkan port, sehingga
  load balancer atau router tidak mengirimkan traffic baru ke instance ini.
- **Selesaikan request yang sedang berjalan** — Request yang sudah masuk ke
  handler tetap diizinkan selesai sampai batas waktu graceful shutdown.
- **Tutup sumber daya** — Koneksi database, cache, file handle, dan sumber daya
  lainnya ditutup secara rapi.
- **Keluar** — Proses berhenti dengan kode keluar nol jika berhasil, atau
  non-nol jika melebihi batas waktu dan harus dibangun paksa.

## Pertimbangan khusus untuk lingkungan production

- Load balancer biasanya mengirim `SIGTERM` sebelum menghapus instance dari
  pool. Graceful shutdown memastikan instance tidak menerima request baru saat
  masih dalam proses pemadaman.
- Container orchestration (seperti Railway) memberikan batas waktu (grace
  period) sebelum memaksa proses berhenti dengan `SIGKILL`. Jika aplikasi
  tidak selesai dalam waktu tersebut, paksa akan digunakan dan request aktif
  akan terputus.
- **Railway secara default memberikan draining time 0 detik.** Artinya container
  lama langsung menerima `SIGTERM` lalu `SIGKILL` tanpa kesempatan menyelesaikan
  request. Set service variable `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (misalnya
  `30`) agar graceful shutdown benar-benar berjalan. Nilai ini harus lebih besar
  dari timeout shutdown aplikasi.
- Setiap instance dalam deployment rolling harus dapat mati secara individu
  tanpa mengganggu traffic keseluruhan, asalkan graceful shutdown berfungsi
  dengan baik.

## Hal yang perlu diperhatikan

- Identifikasi semua sumber daya yang perlu ditutup saat shutdown (koneksi
  eksternal, file, timer, interval, dll).
- Tentukan batas waktu maksimum untuk menunggu request selesai agar proses
  tidak terlalu lama terpecat.
- Pastikan logging mencatat kapan shutdown dimulai dan selesai untuk memudahkan
  pemantauan dan debugging.
- Uji skenario shutdown saat ada request aktif untuk memastikan tidak ada
  koneksi yang terputus secara tiba-tiba.
- Perbedaan antara `SIGTERM` (harus ditangani secara rapi) dan `SIGKILL`
  (tidak dapat ditangani, paksa membunuh proses).

## Checklist implementasi

- [ ] Server dapat menerima sinyal berhenti dari sistem operasi.
- [ ] Penerimaan request baru dihentikan segera setelah sinyal diterima.
- [ ] Request yang sedang diproses diizinkan selesai dengan batas waktu.
- [ ] Semua koneksi eksternal dan sumber daya ditutup sebelum proses keluar.
- [ ] Logging mencatat titik awal dan akhir shutdown.
- [ ] Uji shutdown dengan request aktif di lingkungan staging.
- [ ] Verifikasi load balancer mengarahkan traffic jauh dari instance sebelum
  shutdown dimulai.

## Implementasi Best Practice untuk Elysia.js

Berikut praktik terbaik saat mengimplementasikan graceful shutdown pada
proyek Elysia ini, berdasarkan konvensi framework dan lingkungan deployment:

### Pisahkan definisi app dari titik masuk startup

Definisikan instance Elysia di `src/app.ts` dan ekspor instance-nya, lalu
panggil `.listen()` hanya di `src/index.ts`. Hal ini memisahkan konfigurasi
rute dari siklus hidup proses, mempermudah uji lewat `app.handle()` tanpa
membuka port, dan mendukung AOT build jika diperlukan di masa depan.

### Gunakan `.onStop()` untuk membersihkan resource bersama

Elysia menyediakan siklus hidup `.onStart()` dan `.onStop()` yang menerima
instance app saat server dinyalakan dan dimatikan. Gunakan `.onStop()` untuk
membersihkan resource yang diinisialisasi saat startup, misalnya koneksi
database, klien HTTP, atau cache in-memory. Ini terpisah dari disposal per-request
yang diatur Elysia secara otomatis setelah respons selesai.

### Tangani `SIGTERM` dan `SIGINT` secara simetris

Saat ini `SIGTERM` hanya mencetak log tanpa mematikan server, sedangkan
`SIGINT` memanggil `app.stop()`. Keduanya harus memanggil `await app.stop()`
secara konsisten, lalu keluar dengan kode yang sesuai. Hindari `process.exit()`
segera tanpa memanggil `app.stop()`, karena akan memaksa koneksi aktif terputus.

### Beri batas waktu pada shutdown

Jangan biarkan proses menunggu in-flight request tanpa batas. Tentukan durasi
maksimum untuk graceful shutdown (contohnya 10–30 detik). Jika melebihi batas
waktu, panggil `process.exit(1)` agar orchestration dapat mengganti instance
dengan `SIGKILL` tanpa terjebak selamanya.

### Bind ke semua antarmuka saat platform menyedia port

Saat di-deploy ke platform yang menyediakan variabel `PORT` (seperti Railway),
bind ke `0.0.0.0` agar server menerima traffic dari load balancer:

```ts
app.listen({ port: ENV.PORT, hostname: "0.0.0.0" });
```

### Jangan inisialisasi service eksternal selama AOT build

Jika nanti menggunakan AOT build, inisialisasi koneksi eksternal hanya di luar
blok AOT. Gunakan `inAotBuild()` dari `elysia` untuk mencegah sisi samping
runtime saat captured build. Route dan skema tetap terdefinisi, namun koneksi
database atau external service dibuka saat proses benar-benar berjalan.

### Pertimbangkan worker untuk scaling

Jika deployment membutuhkan lebih dari satu proses, gunakan `cluster` dari Node
dengan `reusePort: true` pada Linux/Bun agar worker dapat berbagi port yang
sama. Sesuaikan jumlah worker dengan batas CPU dan memori container, lalu ukur
lagi. Setiap worker memiliki state memori sendiri, termasuk cache rate limiter.

### Catat semua titik penting shutdown

Log saat sinyal diterima, saat penerimaan request baru dihentikan, saat semua
request aktif selesai, dan saat proses benar-benar keluar. Log ini berguna
untuk memastikan shutdown tidak terjebak dan untuk debugging saat deploy gagal.

### Uji shutdown dengan request aktif

Simulasikan shutdown saat terdapat request yang masih diproses. Verifikasi
bahwa request tersebut selesai dengan respons yang benar sebelum proses keluar,
dan bahwa request baru diblokir segera setelah sinyal shutdown diterima.

## Status implementasi

- `src/app.ts` — definisi app Elysia dan `.onStop()` untuk membersihkan state
  rate limiter.
- `src/lib/graceful-shutdown.ts` — `createGracefulShutdown()` dan
  `listenForShutdownSignals()`.
- `src/index.ts` — listen di `0.0.0.0` dan memasang handler `SIGTERM`/`SIGINT`.
- `src/middleware/rate-limit.ts` — `clearRateLimitState()` untuk membersihkan
  cache saat shutdown.

---
