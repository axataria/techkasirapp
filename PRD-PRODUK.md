# PRD · Produk, spesifikasi, dan identitas unit

**Status** — MVP diterapkan di TechKasir. Katalog lama tetap dapat diisi melalui **Edit spesifikasi**, sedangkan detail unit lama dapat dilengkapi saat QC.

## Tujuan

Pemilik dapat menambahkan produk HP atau laptop dengan spesifikasi yang mudah dicari. Saat menerima barang, petugas dapat mencatat kondisi, identitas, dan keterbatasan setiap unit. Kasir bisa membedakan dua unit dengan model yang sama sebelum memilih barang untuk dijual.

Saat ini **Tambah produk** mencatat kategori, model, dan spesifikasi teks bebas. **Barang masuk** menautkan unit fisik ke katalog dan mencatat kode, serial atau IMEI, serta biaya. MVP mempertahankan pemisahan ini dan menambah field terstruktur pada tempat yang tepat.

## Tambah produk · Data katalog

Satu produk mewakili satu varian. Contohnya, iPhone 13 128 GB dan iPhone 13 256 GB dapat dicatat sebagai dua varian. Banyak unit baru dan bekas dapat merujuk ke varian yang sama.

| Field | Nilai dan aturan | Wajib |
| --- | --- | --- |
| Kategori | HP atau Laptop. Menentukan field yang ditampilkan. | Ya |
| Merek | Contoh Apple, Samsung, ASUS, atau Lenovo. | Ya |
| Model | Nama perangkat, misalnya iPhone 13, Galaxy A55, atau ThinkPad T14 Gen 2. | Ya |
| Platform | HP memakai Android, iOS, atau Lainnya. Laptop memakai Windows, macOS, ChromeOS, Linux, Tanpa OS, atau Lainnya. | Ya |
| Kode model pabrikan | Untuk membedakan varian yang namanya mirip. | Opsional |
| Penyimpanan | Kapasitas dalam GB. Laptop dapat menambahkan jenis SSD atau HDD. | Opsional |
| RAM | Kapasitas dalam GB. Bisa dikosongkan jika tidak diketahui. | Opsional |
| Spesifikasi HP | Varian warna, dukungan 4G atau 5G, dan dukungan eSIM jika diketahui. | Opsional, hanya HP |
| Spesifikasi laptop | Prosesor, GPU, ukuran layar, dan resolusi jika diketahui. | Opsional, hanya laptop |
| Catatan spesifikasi | Detail tambahan yang belum punya field khusus. | Opsional |

**Contoh pengisian** — Kategori **HP**, merek **Apple**, model **iPhone 13**, platform **iOS**, penyimpanan **128 GB**. Windows dan Android dicatat sebagai platform, sedangkan Apple dicatat sebagai merek.

Menyimpan produk menambahkan varian ke katalog. Jumlah stok bertambah setelah unit fisik dicatat dan penerimaannya difinalisasi melalui **Barang masuk**.

## Barang masuk dan QC · Data tiap unit

| Field | Nilai dan aturan |
| --- | --- |
| Kode unit | Wajib dan unik dalam toko. Satu kode menunjuk ke satu unit fisik. |
| Kondisi barang | **Baru** atau **Bekas**, wajib untuk unit baru dicatat. Data lama bisa berstatus **Belum dicatat** sampai dilengkapi. |
| Kondisi fisik | Untuk barang baru, opsional **Segel** atau **Segel dibuka**. Untuk barang bekas, catat gores, penyok, atau minus yang terlihat. |
| Serial atau IMEI | Laptop memakai serial jika tersedia. HP punya IMEI utama dan IMEI kedua bila tersedia. Unit yang belum dapat diperiksa boleh disimpan sebagai draf atau menunggu QC. |
| Kesehatan baterai | Persentase bila tersedia, beserta tanggal pemeriksaan. Kosong berarti belum diukur. Untuk laptop, siklus baterai opsional. |
| Riwayat dan kelengkapan | Riwayat servis atau komponen diganti, dus, charger, dan aksesori. Detail dapat ditandai belum diketahui. |
| Asal dan garansi | Supplier, tanggal masuk, bukti pembelian atau registrasi jika tersedia, serta jenis dan tanggal akhir garansi bila diketahui. |
| Biaya dan harga | Gunakan harga beli, biaya tambahan, biaya perbaikan, dan harga jual target yang sudah ada. Akses biaya mengikuti peran saat ini. |

### Bagian khusus HP · Jaringan dan asal unit

| Istilah toko | Field | Nilai dan perilaku |
| --- | --- | --- |
| **Normal** | Hasil tes sinyal | Normal, Terbatas, Tidak ada sinyal, atau Belum dites. Catat operator yang diuji dan tanggalnya. Normal berarti tes pada operator yang dicatat berhasil. |
| **SIM lock** | Kunci operator | Bebas operator, SIM lock, atau Belum diperiksa. Jika terkunci, catat operator yang diketahui. [Panduan Carrier Lock Apple](https://support.apple.com/en-us/109316) |
| **Inter**, **iBox** | Asal unit | Resmi Indonesia, Inter, atau Belum diketahui. Jika memilih Resmi Indonesia, petugas bisa mengisi nama penjual atau distributor, misalnya iBox, berdasarkan bukti yang tersedia. |
| **Bea Cukai** | Catatan registrasi IMEI | Belum diperiksa, Bukti registrasi tercatat, atau Bukti belum tersedia. Simpan referensi bukti jika ada. Status ini mencatat dokumen yang diperiksa petugas. [FAQ registrasi IMEI Bea Cukai](https://www.beacukai.go.id/faq-impor-registrasi-imei) |
| **Bypass** | Temuan akun atau aktivasi | Tidak ada indikasi, Indikasi bypass atau akun terkunci, atau Belum diperiksa. Catatan wajib jika ada indikasi. Unit ditahan di QC sampai temuan diselesaikan dan diperiksa ulang. |

Field tersebut bisa diisi bersamaan. Contohnya, satu unit dapat berstatus **Inter**, punya **bukti registrasi IMEI**, dan lulus tes sinyal pada operator tertentu. Memilih asal unit atau mencatat bukti tidak mengubah hasil tes jaringan secara otomatis.

## Alur dan validasi

1. Di **Produk → Tambah produk**, pilih kategori dan isi data varian. Bagian laptop dan HP tampil sesuai kategori.
2. Di **Barang masuk**, pilih produk yang sudah ada. Identitas varian terisi dari katalog. Catat kondisi, serial atau IMEI, biaya, dan kelengkapan unit tersebut.
3. Di **QC**, petugas melengkapi hasil yang belum diketahui. Unit dengan kondisi jaringan terbatas atau SIM lock menampilkan keterbatasan di detail unit. Status **Siap dijual** mengikuti hasil QC dan kebijakan toko.
4. Di **Kasir**, tampilkan merek, model, kapasitas, kode unit, kondisi, harga, serta keterbatasan jaringan yang tercatat sebelum kasir memilih unit.

- Simpan IMEI sebagai teks agar digit awal tidak hilang. Jika diisi, validasi 15 digit dan tolak IMEI yang sama pada unit berbeda dalam toko, termasuk antara slot utama dan kedua. Dua slot pada unit yang sama juga tidak boleh memakai nomor yang sama.
- Pergantian kategori menghapus field yang tidak lagi berlaku dari data yang akan disimpan. Server menolak field khusus HP pada laptop dan sebaliknya.
- Produk lama tetap dapat dipakai dengan spesifikasi teks yang ada. Migrasi membiarkan field baru kosong sampai dilengkapi. Riwayat transaksi memakai data yang sudah tercatat pada dokumen sebelumnya.
- Pencarian mendukung merek, model, dan kode unit. Filter awal mencakup kategori, platform, kondisi barang, serta hasil sinyal untuk HP. Serial atau IMEI lengkap tersedia di detail bagi peran yang berwenang.

## Kriteria penerimaan

| Skenario | Hasil |
| --- | --- |
| Tambah iPhone dan laptop Windows | Field yang tampil sesuai kategori dan platform. Menyimpan varian tidak menambah stok fisik. |
| Terima dua unit dengan varian sama, satu baru dan satu bekas | Keduanya menaut ke produk yang sama dan menampilkan kondisi masing-masing di stok dan Kasir. |
| Catat unit Inter dengan bukti Bea Cukai dan tes sinyal Normal | Ketiga informasi tersimpan terpisah dan dapat diperiksa di detail unit. |
| IMEI ganda, termasuk pada slot kedua unit lain | Server menolak penyimpanan identitas duplikat di toko yang sama. |
| Tes belum dilakukan atau ditemukan indikasi bypass | Detail menampilkan status pemeriksaan yang sebenarnya. Temuan bypass menahan unit di QC sampai diperiksa ulang. |
| Buka produk lama dan nota lama | Data teks, hubungan ke unit, serta dokumen lama tetap dapat dibuka. |

## Di luar MVP

Pengecekan IMEI otomatis ke layanan eksternal, sinkronisasi katalog marketplace, unggah massal, dan pemindaian barcode. MVP berfokus pada pencatatan, pemeriksaan, dan pemilihan unit yang tepat di TechKasir.
