# PRD · Pendaftaran, verifikasi email, dan pemulihan akun TechKasir

**Status:** Draf keputusan MVP. Rekomendasi untuk instalasi lokal adalah Opsi A. Kebutuhan verifikasi email menentukan apakah Opsi B atau C lebih cocok.

## Tujuan

Pemilik baru bisa membuat toko dengan data kosong, masuk dengan akun sendiri, dan mengatur ulang kata sandi jika kehilangan akses. Pilihan pemulihan harus sesuai dengan cara TechKasir dijalankan dan kemampuan pemilik menyimpan akses cadangan.

TechKasir saat ini berjalan lokal di `127.0.0.1:3100`. Pembuatan toko terpisah, login username dan kata sandi, serta pemulihan melalui OTP email sudah tersedia. OTP email memerlukan konfigurasi Resend, dan pendaftaran saat ini belum mewajibkan verifikasi email.

## Perbandingan pilihan

| Pilihan | Pendaftaran pemilik | Saat lupa kata sandi | Yang perlu disiapkan | Cocok jika |
| --- | --- | --- | --- | --- |
| **A. Kode pemulihan yang disimpan pemilik** | Isi data toko, username, dan kata sandi. Simpan kode pemulihan yang ditampilkan setelah akun dibuat. Email opsional. | Masukkan kode simpanan dan kata sandi baru di TechKasir. | Pembuatan, penyimpanan hash, dan rotasi kode di server. Pengguna perlu menyimpan kode di tempat yang aman. | TechKasir dipakai lokal atau koneksi internet tidak selalu tersedia. |
| **B. OTP lewat email** | Isi email wajib, buka inbox, lalu salin kode ke TechKasir sebelum akun aktif. | Minta kode baru ke email terverifikasi, lalu masukkan kode dan kata sandi baru. | Resend dan alamat pengirim. Integrasi reset sudah ada, sedangkan verifikasi saat daftar perlu dibangun. | Email harus terverifikasi dan pengguna bisa membuka inbox di HP sambil memakai TechKasir di komputer. |
| **C. Tautan verifikasi dan reset lewat email** | Isi email wajib, lalu buka tautan dan konfirmasi aktivasi. | Buka tautan email dan isi kata sandi baru. | Penyedia email dan URL HTTPS tepercaya yang bisa diakses dari perangkat yang membuka inbox. | Aplikasi dihosting dan langkah tanpa menyalin kode lebih penting. Tautan ke `127.0.0.1` yang dibuka di HP akan menuju HP itu sendiri. |
| **D. Masuk dengan Google** | Pilih akun Google, lalu buat profil toko setelah identitas Google berhasil diverifikasi. | Gunakan proses pemulihan Google untuk akun yang masuk lewat Google. | Konfigurasi Google Identity dan aturan penautan akun lama. | Pengguna terbiasa masuk dengan Google dan aplikasi dapat bergantung pada internet. |

Tautan email mengurangi langkah pengguna pada aplikasi yang dihosting. Tautan perlu kedaluwarsa, sekali pakai, dan baru dipakai setelah pengguna mengonfirmasi tindakan. Google sign-in memerlukan aturan untuk menautkan identitas Google ke akun TechKasir yang sudah ada. [Panduan reset OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#url-tokens) · [Panduan Google](https://developers.google.com/identity/siwg/best-practices)

## Opsi A · MVP yang direkomendasikan untuk TechKasir lokal

**Daftar.** Pemilik mengisi nama toko, nama lengkap, username, dan kata sandi. Server membuat akun pemilik, toko kosong, dan saldo Rp 0 dalam satu transaksi. Layar sukses menampilkan satu kode pemulihan dan meminta pemilik menyimpannya sebelum kembali ke login. Sertakan nama toko dan username agar catatan mudah dikenali. Email boleh ditambahkan kemudian lewat Profil akun.

**Lupa kata sandi.** Di `/lupa-kata-sandi`, pemilik memilih **Gunakan kode pemulihan**, memasukkan kode simpanan, kata sandi baru, dan konfirmasi. Kode yang sah mengidentifikasi akun sehingga pemilik tetap bisa reset jika lupa username. Server memakai kode sekali, mengganti kata sandi, dan mengakhiri sesi lama dalam satu transaksi. Setelah berhasil, layar menampilkan username dan kode pengganti. Pemilik menyimpan kode baru lalu masuk kembali.

**Pemilik lama.** Pemilik yang masih bisa masuk dapat membuat atau mengganti kode dari **Pengaturan → Profil akun** setelah mengonfirmasi kata sandi. Email yang sudah terverifikasi tetap dapat dipakai melalui jalur pemulihan email yang ada. Akun staf tetap dibuat dari Pengaturan dan menggunakan data toko pemiliknya.

**Aturan keamanan.** Buat kode acak dengan entropi 128 bit, tampilkan satu kali, dan simpan hash di server. Terapkan batas percobaan, pesan generik untuk kode yang salah atau sudah terpakai, serta audit tanpa mencatat kode atau kata sandi. Penggantian membatalkan kode lama. Kode ini disimpan pemilik untuk penggunaan di masa depan. [Panduan kode pemulihan tersimpan NIST](https://pages.nist.gov/800-63-4/sp800-63b.html#saved-recovery-codes)

**Batas pemulihan.** Jika pemilik kehilangan kata sandi dan kode, email yang sebelumnya terverifikasi menjadi jalur cadangan selama pengiriman email sudah dikonfigurasi. Tanpa akses tersebut, reset mandiri tidak tersedia. Pemilik yang masih tahu kata sandi bisa masuk untuk membuat kode baru. Pendaftaran tanpa verifikasi email diasumsikan berjalan pada instalasi lokal yang aksesnya dikendalikan pemilik. Jika pendaftaran akan dibuka ke internet, tentukan kontrol pendaftaran sebelum rilis.

### Kriteria penerimaan Opsi A

| Skenario | Hasil |
| --- | --- |
| Daftar tanpa Resend atau koneksi internet | Satu akun pemilik dan toko kosong dibuat. Kode pemulihan ditampilkan satu kali. |
| Respons daftar hilang setelah akun dibuat | Pemilik bisa login dengan username dan kata sandi yang dipilih, lalu membuat kode baru di Profil akun. Pengulangan tidak membuat toko kedua. |
| Reset dengan kode yang benar | Akun yang tepat dipulihkan, kata sandi lama gagal, sesi lama berakhir, dan kode lama tidak dapat dipakai lagi. |
| Dua permintaan reset memakai kode yang sama | Hanya satu yang boleh mengubah kata sandi. |
| Kode salah, hilang, atau sudah diganti | Tidak ada perubahan akun. Jika tersedia, pengguna bisa memilih pemulihan melalui email terverifikasi. |
| Toko lama dan akun staf masuk | Akses dan data masing-masing tetap sesuai toko. |

## Opsi B · Spesifikasi jika email wajib diverifikasi

- Pendaftaran pemilik dengan email wajib. Gmail dan alamat email lain yang dapat menerima OTP didukung.
- Verifikasi sebelum akun dan toko dibuat. Toko baru memiliki saldo Rp 0 serta stok, pelanggan, dan transaksi kosong.
- Login dengan username dan kata sandi TechKasir. Integrasi **Masuk dengan Google** dan OTP pada setiap login berada di luar MVP.
- Halaman **Lupa kata sandi** dapat dibuka tanpa sesi login. Pemulihan pemilik memakai email terverifikasi.
- Akun staf dibuat dari **Pengaturan → Staf dan akses** dan bergabung ke toko pemilik. Aturan akses dan alur pemulihan staf yang sudah tersedia tetap berlaku.

## Alur pengguna

| Langkah | Tampilan dan tindakan | Hasil |
| --- | --- | --- |
| 1. Daftar | Pilih **Buat toko baru**. Isi nama toko, nama pemilik, username, email, kata sandi, dan konfirmasi kata sandi. Tekan **Kirim kode verifikasi**. | Server memvalidasi formulir dan menyimpan pendaftaran sementara. OTP dikirim ke alamat yang dimasukkan. |
| 2. Verifikasi email | Buka inbox Gmail, lalu masukkan kode 8 digit di halaman verifikasi. Tersedia **Kirim ulang kode** dan **Ubah email**. | Jika kode sah, server membuat toko, akun pemilik, dan saldo awal Rp 0 dalam satu transaksi. Email langsung terverifikasi untuk pemulihan. |
| 3. Masuk | Setelah verifikasi berhasil, kembali ke login dan gunakan username serta kata sandi. | Pemilik masuk ke Dasbor toko barunya. |
| 4. Minta pemulihan | Dari login, buka **Lupa kata sandi?** di `/lupa-kata-sandi`. Isi email, lalu pilih **Kirim kode**. | Pesan umum untuk setiap alamat valid: “Jika email ini terdaftar, kode pemulihan akan dikirim.” Kode hanya dikirim untuk akun aktif dengan email terverifikasi. |
| 5. Reset kata sandi | Masukkan OTP, kata sandi baru, dan konfirmasi. Pilih **Ubah kata sandi**. | Server memakai kode sekali, menyimpan kata sandi baru, dan mengakhiri seluruh sesi lama akun itu. Tampilkan username hanya setelah reset berhasil, lalu arahkan kembali ke login. |

Langkah 5 memakai satu formulir untuk kode dan kata sandi baru. Ini memungkinkan halaman khusus menggunakan endpoint reset yang sudah ada tanpa membuat sesi pemulihan tambahan.

## Aturan pendaftaran dan OTP

- Terapkan verifikasi pada semua jalur pembuatan pemilik, termasuk penyiapan instalasi baru. Endpoint pendaftaran lama mengikuti aturan yang sama agar verifikasi tidak bisa dilewati.
- Simpan pendaftaran sementara hingga 24 jam. Simpan hash kata sandi dan hash OTP. Ikat OTP ke pendaftaran, alamat email, tujuan, dan cookie sesi pendaftaran `HttpOnly`. Kode dari pendaftaran lain ditolak, termasuk jika alamat emailnya sama. Jangan masukkan OTP, kata sandi, atau email ke URL.
- Gunakan normalisasi email yang sama seperti Profil akun dan pemulihan saat ini, yaitu buang spasi di awal dan akhir lalu ubah ke huruf kecil. Pertahankan titik dan `+tag`. Satu alamat email terverifikasi terkait dengan satu akun. Periksa keunikan username dan email lagi saat aktivasi agar pengiriman ulang atau permintaan paralel tidak membuat dua akun.
- OTP berisi 8 digit, berlaku 10 menit, bisa dipakai sekali, dan terkunci setelah 5 kode salah. Kirim ulang paling cepat setelah 60 detik. Sebagai batas awal, izinkan maksimal 3 pengiriman dan 10 tebakan per alamat dalam 30 menit, serta 30 permintaan per IP dalam 15 menit. Kirim ulang membatalkan kode sebelumnya dan tidak mengulang jatah tebakan per alamat.
- Kode pendaftaran dan kode reset hanya berlaku untuk tujuan dan alamatnya masing-masing. Mengubah alamat sebelum verifikasi membatalkan kode sebelumnya. Simpan audit hasil verifikasi dan reset tanpa mencatat kode atau kata sandi.
- Jika pengiriman saat daftar gagal, pertahankan langkah pendaftaran dan tampilkan cara mencoba kembali. Pada pemulihan, pertahankan pesan umum agar kegagalan provider tidak mengungkap keberadaan akun.

Aturan verifikasi dan pemulihan mengikuti panduan OWASP. Angka durasi dan batas percobaan di atas adalah pilihan untuk TechKasir. [Verifikasi email](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html) · [Lupa kata sandi](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

## Akun lama dan kesiapan rilis

- Pemilik lama bisa masuk dengan kredensialnya dan menambahkan Gmail dari **Pengaturan → Profil akun → Email pemulihan**. Akun lama yang belum punya email terverifikasi belum dapat memakai reset mandiri.
- Pertahankan email yang sudah terverifikasi sampai alamat pengganti berhasil diverifikasi. Perubahan email dari Profil akun memerlukan kata sandi saat ini.
- Siapkan Resend, alamat pengirim dari domain terverifikasi, dan rahasia OTP di server sebelum mengaktifkan pendaftaran wajib email. Bila konfigurasi belum siap, beri keterangan yang jelas pada pendaftaran. Login yang sudah ada tetap tersedia. [Dokumentasi Resend](https://resend.com/docs/api-reference/emails/send-email)
- Uji kirim ke inbox Gmail yang ditunjuk sebelum rilis, selain pengujian dengan pengiriman simulasi.

## Kriteria penerimaan

| Skenario | Hasil yang harus terlihat |
| --- | --- |
| Daftar tanpa email atau dengan email salah format | Formulir menunjukkan kesalahan dan tidak meminta pengiriman OTP. |
| Daftar dan terima kode, tetapi belum verifikasi | Username belum bisa login dan toko belum dibuat. |
| Verifikasi berhasil, tombol diklik dua kali, atau respons hilang setelah aktivasi | Tepat satu akun pemilik dan satu toko dibuat. Email terverifikasi dan Dasbor dimulai kosong. Sesi pendaftaran yang sama dapat melihat status akun aktif dan kembali ke login. |
| Kode salah, kedaluwarsa, terpakai, atau dari proses lain | Verifikasi ditolak. Setelah kirim ulang, hanya kode terbaru yang berlaku. |
| Email atau username sudah dipakai, termasuk saat dua aktivasi bersamaan | Tidak ada duplikasi atau toko tanpa pemilik. Pengguna dapat kembali ke login atau pemulihan. |
| Pemulihan dengan email tak terdaftar atau belum terverifikasi | Respons publik sama seperti permintaan yang valid. Tidak ada email reset yang dikirim. |
| Reset berhasil | Username muncul, kata sandi lama gagal, sesi lama berakhir, dan kata sandi baru berhasil saat login. |
| Pemilik lama dan staf login setelah rilis | Akses dan data toko sesuai akun masing-masing. Toko baru tidak dapat membuka data atau dokumen toko lain. |
| Penyedia email gagal atau belum dikonfigurasi | Pendaftaran tidak mengaktifkan akun tanpa OTP. Halaman login tetap dapat dipakai oleh akun yang sudah aktif. |
