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

---