# PRD v2 — Perombakan TechKasir

Tanggal: 8 November 2026  
Status: Acuan kebutuhan v2; implementasi MVP dan batas rilis tersedia di [V2.md](V2.md)  
Bahasa: Indonesia · Mata uang: IDR · Zona waktu tampilan: Asia/Jakarta

## 1. Arahan dan batas perubahan

Merombak struktur aplikasi, halaman operasional, dan alur kerja TechKasir untuk toko laptop dan HP. Sidebar mengikuti urutan dan label pada gambar referensi pengguna. Design system serta bagian login yang sudah ada dipertahankan.

Dokumen ini menjadi acuan perubahan v2. [PRD lama](PRD.md), [WORKFLOWS.md](WORKFLOWS.md), dan [ERD.md](ERD.md) adalah referensi kebutuhan serta model sebelumnya; ketiganya belum menyatakan implementasi v2. Jika bertentangan, struktur navigasi dan kebutuhan v2 mengikuti dokumen ini. Gambar adalah referensi navigasi, bukan sumber kebijakan bisnis.

**Tetap dipertahankan:**

- Design system aktual di `public/style.css`, komponen yang sudah dipakai, dan pengaturan tema di `public/theme.js`: Plus Jakarta Sans, token warna, light/dark mode, palet, material permukaan, tipografi, spacing, radius, tombol, field, tabel, badge, dialog, dan pola feedback.
- Tampilan, field, validasi, pesan, serta alur login dan setup toko yang sudah ada. Akun, kata sandi, session, logout, dan pembatasan akses tetap berfungsi.
- Data pelanggan, unit, servis, transaksi, pembayaran, invoice, bukti pembayaran, serta audit yang sudah tersimpan.
- Stack lokal saat ini: JavaScript native, Node.js, SQLite; migrasi framework bukan kebutuhan perombakan.

**Dirombak:** struktur navigasi, susunan konten, alur kasir, halaman modul, relasi antarproses, dan kebutuhan data untuk garansi, retur, penerimaan barang, serta QC. “Mengganti semuanya” berarti perombakan pengalaman kerja setelah login, bukan menghapus data atau membangun ulang autentikasi.

Tidak perlu menyalin warna, font, ukuran, atau tekstur foto. Penyesuaian layout sidebar menggunakan komponen dan token yang sudah ada.

## 2. Tujuan dan ukuran keberhasilan

| Tujuan | Kriteria keberhasilan |
| --- | --- |
| Navigasi sesuai referensi | Pemilik melihat 12 menu utama dengan label dan urutan persis pada bagian 4. |
| Kasir menjadi ruang transaksi | Pengguna menyelesaikan pemilihan unit, pelanggan, pembayaran, dan penerbitan invoice dalam satu alur. |
| Stok bisa ditelusuri | Setiap unit baru dapat ditelusuri dari barang masuk, hasil QC, kesiapan jual, penjualan, hingga garansi atau retur. |
| Pergerakan barang dan uang konsisten | Retur barang tidak otomatis dianggap sebagai uang kembali; stok, utang/piutang, dan pembayaran bisa direkonsiliasi. |
| Fitur lama tetap dapat ditemukan | Servis, pembayaran, keuangan, staf, dan audit memiliki tujuan navigasi yang terdokumentasi. |
| Tampilan dan login konsisten | Tidak ada perubahan token visual global, preferensi tema, atau perilaku autentikasi akibat perombakan. |

## 3. Kondisi aplikasi sekarang

Pemeriksaan `public/app.js`, `public/style.css`, `public/theme.js`, `server.mjs`, dan `README.md` menunjukkan aplikasi lokal sudah memiliki login berbasis peran, pelanggan, stok unit individual, penjualan, servis, pembayaran, keuangan, laporan, staf, dan audit. Navigasi masih memakai Ringkasan, Pelanggan, Stok unit, Penjualan, Servis, Pembayaran, Keuangan, Laporan, Pengaturan, Log perubahan, serta Staf.

Penjualan saat ini berbasis satu unit per transaksi. Retur pelanggan/refund belum menjadi alur lengkap. Status `Retur` pada unit tidak cukup mewakili retur pelanggan dan supplier. Belum ada modul QC, garansi, dan dokumen barang masuk yang terpisah. Dokumen desain lama memuat arahan visual historis; design system aktual dalam kode adalah baseline yang dipertahankan.

## 4. Sidebar target

| Urutan | Label persis | ID halaman usulan | Fungsi | Ikon semantik |
| --- | --- | --- | --- | --- |
| 1 | Dasbor | `dashboard` | Ringkasan dan tugas operasional | Grid |
| 2 | Kasir | `pos` | Membuat penjualan dan menerima pembayaran | Kasir/kartu |
| 3 | Riwayat pesanan | `orders` | Pesanan, invoice, pelunasan, dan servis | Daftar |
| 4 | Pelanggan | `customers` | Profil dan riwayat pelanggan | Pengguna |
| 5 | Garansi | `warranties` | Hak garansi dan klaim | Perisai |
| 6 | Retur pelanggan | `customer-returns` | Pengembalian barang dari pelanggan | Panah kiri |
| 7 | Produk | `products` | Katalog dan unit fisik | Kotak |
| 8 | Barang masuk | `receiving` | Penerimaan dari supplier | Panah turun |
| 9 | QC | `qc` | Pemeriksaan kelayakan unit | Centang |
| 10 | Retur supplier | `supplier-returns` | Pengembalian barang ke supplier | Panah kanan |
| 11 | Report | `reports` | Laporan serta pencatatan keuangan | Grafik batang |
| 12 | Pengaturan | `settings` | Toko, tema, staf, kebijakan, audit | Slider |

ID di atas adalah usulan pengenal halaman, bukan janji URL. Router saat ini menggunakan state halaman dan belum memiliki deep link modul.

Ketentuan sidebar:

- Satu daftar vertikal, ikon outline di kiri dan label di kanan, tanpa tambahan menu utama di luar 12 item tersebut.
- Halaman aktif memiliki latar terpilih dan penekanan label menggunakan token yang tersedia. Contoh aktif “Kasir” pada gambar tidak berarti Kasir selalu aktif.
- Indikator aktif mengikuti modul induk saat membuka detail atau tab. Urutan relatif tetap ketika sebagian menu disembunyikan oleh izin.
- Collapse/expand, tooltip pada mode ikon, penyimpanan preferensi, focus keyboard, dan reduced motion tetap tersedia.
- Daftar dapat digulir ketika tinggi layar tidak cukup. Pengaturan tetap bisa dijangkau.
- Pada seluler, seluruh menu yang diizinkan dapat diakses melalui navigasi yang muat pada layar; label panjang tidak terpotong tanpa cara membaca lengkapnya.
- Identitas toko, pencarian global, dan menu akun tetap tersedia. Logout tetap melalui menu akun.
- Pemilik masuk ke Dasbor, kasir ke Kasir. Staf servis masuk ke tab Servis dalam Riwayat pesanan sebagai tujuan kerja yang diusulkan; form login tidak berubah.

## 5. Pengguna dan akses

Tetap memakai peran `owner`, `cashier`, dan `service`. Tidak menambah peran baru pada tahap awal. Tabel berikut merupakan usulan izin modul v2; akses lama ke servis dan pembayaran terkait harus dipertahankan.

| Modul | Pemilik | Kasir | Staf servis |
| --- | --- | --- | --- |
| Dasbor | Seluruh metrik | Tidak tampil awalnya | Tidak tampil awalnya |
| Kasir | Buat transaksi | Buat transaksi | Tidak tersedia |
| Riwayat pesanan | Seluruh pesanan/servis | Penjualan dan pembayaran penjualan | Servis dan pembayaran servis |
| Pelanggan | Kelola dan riwayat lengkap | Data relevan penjualan | Data relevan servis/klaim |
| Garansi | Kelola kebijakan dan keputusan | Cek hak, catat klaim | Pemeriksaan dan progres klaim |
| Retur pelanggan | Setujui dan finalisasi | Ajukan serta lihat terkait penjualan | Pemeriksaan unit yang ditugaskan |
| Produk | Kelola, lihat modal | Lihat unit siap jual tanpa modal | Lihat unit dan kondisi tanpa modal |
| Barang masuk | Kelola dan finalisasi | Tidak tersedia | Lihat unit untuk pemeriksaan tanpa modal |
| QC | Kelola dan putuskan | Tidak tersedia | Catat pemeriksaan dan hasil |
| Retur supplier | Kelola dan finalisasi | Tidak tersedia | Catat pemeriksaan terkait tanpa modal |
| Report | Seluruh laporan/keuangan | Tidak tersedia | Tidak tersedia |
| Pengaturan | Seluruh pengaturan | Preferensi tampilan pribadi | Preferensi tampilan pribadi |

Izin wajib diterapkan pada API, pencarian global, detail, ekspor, dan dokumen, bukan hanya menyembunyikan menu. Modal, margin, dan laba tidak boleh bocor ke respons peran yang tidak berwenang.

## 6. Kebutuhan per modul

### 6.1 Dasbor

- Ringkasan penjualan neto, kas masuk/keluar, piutang, unit siap jual, antrean QC, klaim garansi aktif, serta retur terbuka.
- Filter periode yang konsisten dengan Report. Pemilik dapat melihat laba dan nilai persediaan.
- Tugas yang perlu ditindaklanjuti: barang menunggu QC, QC gagal, klaim baru, pengajuan retur, serta pembayaran belum lunas.
- Klik ringkasan membuka daftar sumber dengan filter terkait. Periode serta filter terlihat, bukan tersimpan sebagai konteks tersembunyi.

### 6.2 Kasir

**Arahan layout:** mengikuti referensi Kasir tambahan dari pengguna: katalog/pencarian pada area utama di kiri dan keranjang sebagai sidebar kanan. Sidebar navigasi aplikasi tetap di kiri; sidebar kanan adalah panel transaksi khusus halaman Kasir. Seluruh warna, font, material, dan komponen mengikuti design system aktual.

#### Susunan desktop

- Header halaman memuat judul Kasir dan tanggal lokal Asia/Jakarta. Tanggal pada gambar hanya contoh, bukan nilai tetap.
- Area utama yang fleksibel memuat input pencarian, tombol Cari, filter seperlunya, dan daftar/kartu unit. Setiap item menampilkan model, spesifikasi ringkas, identitas unit, serta harga dengan posisi yang mudah dipindai. Memilih item menambahkannya ke keranjang tanpa berpindah halaman.
- Panel kanan tetap terlihat ketika daftar produk digulir. Lebarnya cukup untuk nama item, field harga, dan ringkasan; memakai token spacing serta breakpoint sistem yang ada. Daftar item dalam panel dapat digulir, sementara total dan tindakan pembayaran tetap mudah dijangkau.
- Urutan panel kanan: pilihan kanal Toko/Marketplace → judul Keranjang dan jumlah unit → item terpilih → pelanggan → ringkasan nominal → metode/nominal pembayaran → tombol Simpan transaksi.
- Pilihan Toko/Marketplace menggunakan kontrol pilihan tunggal bergaya tab dengan indikator aktif. Toko adalah default; pilihan kanal disimpan pada transaksi dan dapat ditampilkan di riwayat serta difilter di Report. Marketplace pada tahap awal adalah pencatatan kanal manual, tanpa sinkronisasi pesanan atau pembayaran eksternal.
- Item keranjang menampilkan nama/model, spesifikasi seperti RAM/SSD, kode unit, harga ringkas di kanan, serta field berlabel Harga jual yang bisa diedit manual. Harga awal berasal dari target harga unit; perubahan hanya berlaku pada transaksi berjalan, tidak mengganti harga katalog/modal.
- Harga manual menggunakan input rupiah yang sudah ada, menerima nominal nonnegatif, serta menghitung ulang subtotal, total, sisa, dan kembalian ketika input valid. Input kosong/tidak valid diberi pesan dan memblokir simpan. Harga manual, diskon, dan nilai penjualan final tersimpan dalam snapshot transaksi; modal tetap mengikuti izin.
- Area kuantitas berada di dekat harga/item seperti referensi. Karena satu unit adalah satu barang fisik unik, kuantitas per kode unit selalu 1. Pada MVP satu unit per transaksi, tampilkan jumlah 1 dan aksi hapus/ganti unit; kontrol tambah/kurang tidak boleh mengesankan bahwa satu unit berserial dapat dijual berkali-kali. Jika transaksi banyak unit ditambahkan nanti, penambahan jumlah wajib memilih unit fisik lain yang tersedia.
- Keranjang kosong menampilkan petunjuk memilih unit dari area kiri. Menghapus item mengembalikan kondisi kosong dan menonaktifkan simpan; pencarian atau perubahan kanal tidak menghapus input transaksi yang masih relevan.

#### Perilaku transaksi dan pembayaran

- Cari unit berdasarkan kode unit, model, dan serial/IMEI jika tersedia. Hanya unit siap jual yang dapat dipilih.
- MVP tetap satu unit per transaksi sesuai backend sekarang. Transaksi banyak unit memerlukan perluasan model dan tidak dianggap sudah tersedia; bentuk panel kanan tetap mengikuti referensi.
- Pilih pelanggan atau buat pelanggan dari alur kasir. Penjualan DP/belum bayar wajib memiliki pelanggan dengan kontak.
- Metode pembayaran Cash, Transfer, atau QRIS. Dukung lunas, DP, dan belum bayar. Validasi nominal di server.
- Tampilkan subtotal, diskon, total, diterima, sisa tagihan, dan kembalian bila pembayaran tunai lunas. Untuk tunai, jumlah tender dan kembalian ditampilkan terpisah; pembayaran yang diposting hanya sebesar pelunasan, tanpa membuat saldo lebih bayar.
- Konfirmasi transaksi menyimpan penjualan, perubahan ketersediaan unit, invoice, pembayaran awal, dan bukti pembayaran secara atomik. Pengiriman ulang tidak boleh menciptakan penjualan/pembayaran ganda.
- Sukses menyediakan buka/cetak invoice dan transaksi baru. Gagal menyimpan mempertahankan input; jika unit sudah terjual oleh sesi lain, beri pesan dan minta memilih ulang.

#### Responsif dan aksesibilitas

- Pada layar sempit, katalog dan panel transaksi ditumpuk: katalog di atas, keranjang di bawah dengan tombol menuju keranjang dan jumlah unit. Sidebar kanan tidak dipaksakan menjadi kolom sempit.
- Pada 390px, nama model, harga, kontrol item, serta tindakan utama tetap terbaca tanpa overflow horizontal halaman. Ringkasan dan tombol simpan tidak menutupi field yang sedang digunakan atau keyboard perangkat.
- Field harga memiliki label yang jelas; perubahan total terbaca oleh pembaca layar tanpa memindahkan focus. Pilihan kanal, pencarian, hapus item, serta pembayaran dapat dijalankan dengan keyboard.

### 6.3 Riwayat pesanan

**Arahan layout riwayat pembayaran:** referensi tambahan pengguna menampilkan halaman berjudul Riwayat pesanan. Terapkan susunan tersebut pada menu Riwayat pesanan, dengan riwayat pembayaran di detail pesanan terpilih. Tidak menambah menu utama Riwayat pembayaran sehingga sidebar tetap sesuai arahan awal.

#### Filter dan daftar transaksi

- Header memuat judul Riwayat pesanan dan konteks pengguna sesuai pola aplikasi.
- Baris filter di atas daftar/detail berisi Channel (Semua, Toko, Marketplace), Status, Dari tanggal, Sampai tanggal, kolom Cari, dan tombol Terapkan. Sediakan aksi reset filter. Pilihan kanal memakai nilai yang dicatat dari Kasir.
- Pisahkan filter status proses dari status pembayaran agar Selesai tidak disamakan dengan Lunas. Status pembayaran mencakup Semua, Belum Bayar, DP, dan Lunas; status proses mengikuti jenis pesanan. Label status Packing pada gambar tidak otomatis menambah proses pengiriman ke MVP.
- Rentang tanggal menyaring tanggal transaksi secara inklusif dalam Asia/Jakarta; tanggal awal setelah tanggal akhir menampilkan validasi. Pencarian menerima nomor pesanan, invoice, pelanggan/kontak, kode unit, dan model sesuai izin.
- Di desktop, area kiri berupa daftar kartu transaksi yang dapat digulir dan memiliki pagination. Area kanan memuat detail kartu terpilih, bukan keranjang baru atau form pembuatan transaksi.
- Kartu menampilkan nomor pesanan, status proses, nama pelanggan atau Tanpa nama, kanal, ringkasan model/spesifikasi, tanggal dan waktu, serta total tagihan dengan format rupiah. Status pembayaran terlihat terpisah bila berbeda dari status proses.
- Kartu aktif memakai latar/border terpilih dari token sistem. Memilih kartu memperbarui detail kanan tanpa meninggalkan halaman dan mempertahankan filter/posisi daftar.
- Urutan default adalah transaksi terbaru lebih dahulu. Setelah filter berubah, pertahankan pilihan jika masih ada di hasil; jika tidak, pilih hasil pertama. Hasil kosong menampilkan pesan dan mengosongkan detail agar transaksi lama tidak terlihat sebagai hasil filter baru.

#### Detail pesanan dan riwayat pembayaran

- Bagian atas detail menampilkan nomor pesanan, pelanggan/kontak, kanal, status proses, status pembayaran beserta metode pembayaran yang tercatat, dan status garansi. Nilai berasal dari transaksi aktual, bukan contoh nama/nominal dalam gambar.
- Rincian item memperlihatkan model, spesifikasi, kode unit, kuantitas, serta harga jual saat transaksi. Jumlah item mengikuti transaksi sebenarnya; contoh banyak item pada gambar tidak mengubah batas MVP satu unit per transaksi.
- Ringkasan menampilkan subtotal, diskon bila ada, total tagihan neto, total pembayaran valid, sisa tagihan, serta biaya lain bila memang tercatat. Biaya platform/layanan marketplace tidak dibuat otomatis tanpa field dan kebijakan yang ditetapkan.
- Riwayat pembayaran berupa daftar kronologis: tanggal/waktu, jenis pembayaran (DP/pelunasan), nominal pembayaran tersebut, metode (Cash/Transfer/QRIS), referensi, petugas, nomor bukti, dan aksi buka/cetak bukti. Gunakan tanggal pembayaran yang tercatat; jangan mengarang jam untuk data lama yang hanya memiliki tanggal.
- Untuk transaksi yang menerima DP, tampilkan DP awal dan pembayaran lanjutan sebagai entri berbeda. Total dibayar menjumlah pembayaran valid, bukan menggandakan DP sebagai komponen tagihan.
- Pembayaran dibalik/dikoreksi tetap terlihat dengan penanda dan tautan bukti koreksinya, tetapi tidak dihitung sebagai pembayaran valid. Refund ditampilkan sebagai uang keluar terkait retur, terpisah dari penerimaan pelanggan.
- Tombol Cetak nota membuka invoice pesanan; setiap pembayaran memiliki aksi cetak bukti tersendiri. Mencetak ulang tidak membuat invoice, pembayaran, atau nomor dokumen baru. Dokumen mengikuti snapshot dan izin yang sudah berlaku.
- Aksi Tambah pembayaran tersedia bagi peran berwenang ketika masih ada tagihan. Setelah berhasil, riwayat, total dibayar, sisa, dan status pada kartu/detail diperbarui tanpa membuat pesanan baru.
- Status garansi menaut ke hak atau klaim terkait bila tersedia. Retur dan koreksi menaut ke proses sumber; bukan perubahan nominal langsung pada invoice terbit.

#### Responsif dan kondisi halaman

- Pada layar sempit, tampilkan daftar terlebih dahulu; memilih transaksi membuka detail dengan aksi Kembali ke daftar yang mempertahankan pencarian, filter, dan posisi. Hindari dua kolom yang terlalu sempit pada 390px.
- Filter dapat membungkus atau dibuka dalam panel filter sesuai komponen yang ada. Nomor pesanan, nominal, dan tombol cetak tetap terbaca serta dapat dijangkau dengan keyboard.
- Sediakan kondisi memuat daftar/detail, tidak ada transaksi, tidak ada hasil filter, detail gagal dimuat dengan coba lagi, dan akses ditolak. Jangan menampilkan detail transaksi sebelumnya di bawah judul transaksi baru saat pengambilan detail gagal.
- Pembatasan peran tetap berlaku untuk daftar, detail, riwayat pembayaran, pencarian, dan dokumen. Kasir tidak mendapat data modal/laba atau transaksi servis yang tidak diizinkan melalui panel ini.

#### Fungsi yang dipertahankan

- Tab Penjualan dan Servis. Servis pelanggan tetap proses tersendiri, tidak berubah menjadi klaim garansi.
- Cari berdasarkan nomor transaksi, pelanggan, unit, atau model; filter tanggal, status pembayaran, dan status proses.
- Detail penjualan menampilkan item, harga saat transaksi, diskon, pembayaran, invoice, serta tautan garansi/retur.
- Pelunasan dilakukan dari detail pesanan dan profil pelanggan; setiap pembayaran menerbitkan bukti unik.
- Tab Servis mempertahankan penerimaan, keluhan, estimasi, DP, pekerjaan, biaya part/teknisi, penyelesaian, dan invoice servis. DP sebelum selesai tetap terpisah dari pendapatan yang diakui.
- Koreksi atau pembatalan transaksi tercatat dengan alasan dan audit. Dokumen yang sudah terbit tidak ditimpa diam-diam.

### 6.4 Pelanggan

- Daftar dan detail pelanggan: nama, kontak, catatan, riwayat pembelian, servis, garansi, retur, serta DP/pelunasan.
- Piutang invoice final ditampilkan terpisah dari uang muka servis yang belum selesai.
- Pencocokan nama/nomor membantu menghindari duplikasi; jangan otomatis menggabungkan profil dengan nomor sama.
- Bukti transaksi mempertahankan snapshot identitas saat penerbitan.

### 6.5 Garansi

- Pisahkan hak garansi dari kasus klaim. Hak garansi terkait item penjualan dan unit, dengan tanggal mulai, tanggal berakhir, cakupan, pengecualian, serta versi kebijakan.
- Hak garansi dibuat saat penjualan sesuai kebijakan yang berlaku; transaksi tanpa garansi harus berlabel jelas.
- Klaim merekam nomor, penjualan asal, pelanggan, unit, keluhan, tanggal diterima, petugas, hasil pemeriksaan, tindakan, biaya jika ada, dan histori.
- Status usulan: Diajukan → Diperiksa → Diproses → Selesai; alternatif Ditolak atau Dibatalkan. Penolakan wajib disertai alasan.
- Tindakan dapat berupa perbaikan, penggantian, atau rekomendasi retur. Refund tetap melalui Retur pelanggan agar tidak tercatat dua kali.
- Unit yang sedang ditangani klaim tidak boleh menjadi stok siap jual milik toko hanya karena diterima untuk servis.
- Klaim yang sudah diterima dalam masa garansi tetap dapat diselesaikan setelah masa garansi berakhir. Kebijakan pengecualian membutuhkan keputusan pemilik.

### 6.6 Retur pelanggan

- Buat dari penjualan asli; pilih unit, alasan, tanggal, kondisi, bukti jika dibutuhkan, dan permintaan penyelesaian.
- Status usulan: Diajukan → Diperiksa → Disetujui → Selesai; alternatif Ditolak atau Dibatalkan. Status selesai mensyaratkan penyelesaian barang dan finansial telah dicatat.
- Pemilik menyetujui hasil pemeriksaan serta nilai penyelesaian. Pengajuan belum mengubah stok atau uang.
- Saat unit diterima untuk retur yang disetujui, unit masuk karantina/menunggu QC dan tidak langsung siap dijual.
- MVP penyelesaian berupa pengembalian unit dan kredit retur yang mengurangi piutang terlebih dahulu; kelebihannya menjadi kewajiban refund. Pembayaran refund adalah catatan uang keluar tersendiri.
- Nilai kumulatif retur dibatasi nilai neto item asal; refund tunai dibatasi kelebihan pembayaran valid setelah kredit retur. Cegah retur aktif ganda atas unit dan penjualan yang sama.
- Invoice asal tetap tersimpan. Terbitkan dokumen retur/kredit yang terkait, serta bukti pembayaran ketika refund dibayarkan. Laba dan HPP disesuaikan melalui transaksi koreksi yang dapat ditelusuri.
- Penggantian lintas produk, tukar tambah, dan kredit saldo pelanggan ditunda hingga kebijakannya ditetapkan.

### 6.7 Produk

- Pisahkan produk/model sebagai katalog dari unit fisik individual. Satu model dapat memiliki banyak unit dengan kondisi, modal, harga, dan serial berbeda.
- Data katalog: nama/model, kategori Laptop/HP, spesifikasi umum, serta status aktif. Data unit: kode unik, serial/IMEI opsional, kondisi, biaya, target harga, pemasok, dan sumber penerimaan.
- Status stok turunan membedakan Menunggu QC, Dalam perbaikan, Siap dijual, Terjual, Karantina retur, dan Dikembalikan ke supplier. Status tersebut bukan field bebas yang bisa diubah tanpa proses sumber.
- Detail unit memperlihatkan perjalanan barang masuk → QC → penjualan → garansi/retur, termasuk pemeriksaan ulang.
- Produk/unit bersejarah diarsipkan, bukan dihapus. Unit yang punya transaksi tidak boleh diganti identitasnya untuk dipakai menjual barang lain.

### 6.8 Barang masuk

- Dokumen penerimaan berisi nomor, tanggal, supplier, referensi pembelian, daftar unit, biaya pembelian/perbaikan/modal lain, catatan, dan pembayaran supplier bila ada.
- Supplier memiliki ID stabil, nama, kontak, serta histori penerimaan/retur. Pengelolaannya berada di dalam Barang masuk dan Retur supplier, tanpa menu utama tambahan.
- Draf belum memengaruhi persediaan. Finalisasi membuat unit unik dalam status Menunggu QC beserta histori penerimaan dan kewajiban supplier, dalam satu transaksi database.
- Cegah kode unit ganda dan serial/IMEI ganda jika diisi. Kebijakan keunikan berlaku per toko.
- Pembayaran pembelian dicatat terpisah dengan bukti; penerimaan belum dibayar tetap dapat memiliki utang supplier.
- Setelah finalisasi, koreksi melalui alur tercatat; dokumen tidak boleh dihapus untuk menghilangkan jejak stok.

### 6.9 QC

- Antrean berdasarkan penerimaan baru, unit retur pelanggan, atau pemeriksaan ulang setelah perbaikan.
- Checklist usulan: identitas/serial, fisik, layar, baterai, keyboard/touch, port, konektivitas, kamera/audio, charger/aksesori, dan fungsi utama. Item disesuaikan Laptop/HP; hasil Tidak berlaku perlu alasan.
- Catat pemeriksa, waktu, hasil per item, catatan kerusakan, dan keputusan akhir.
- Hasil: Lulus, Perlu perbaikan, atau Gagal. Hanya hasil Lulus yang menjadikan unit milik toko siap jual; penerimaan untuk klaim pelanggan tidak menambah stok toko.
- Perbaikan diikuti QC ulang dengan histori baru; hasil lama tidak ditimpa. Biaya perbaikan unit toko menambah modal sesuai kebijakan, tanpa tercatat lagi sebagai biaya operasional.
- Gagal QC dapat memulai pengajuan Retur supplier, tetapi tidak otomatis mengirim barang atau menerbitkan refund.
- QC wajib untuk penerimaan baru dan retur yang akan dijual ulang. Unit historis siap jual dipertahankan sesuai aturan migrasi.

### 6.10 Retur supplier

- Terkait dokumen barang masuk, supplier, dan unit yang benar-benar dimiliki toko serta belum terjual. Unit asal retur pelanggan harus menyelesaikan penerimaan kembali terlebih dahulu.
- Rekam alasan, hasil QC, tanggal, nilai klaim, dan penyelesaian: penggantian unit, pengurangan utang, atau refund supplier.
- Status usulan: Draf → Diajukan → Disetujui → Dikirim → Selesai; alternatif Ditolak atau Dibatalkan sebelum dikirim. Persetujuan adalah otorisasi internal, bukan bukti persetujuan supplier.
- Unit dikarantina saat retur disetujui dan dikeluarkan dari persediaan saat dikirim. Catat klaim ke supplier sampai penyelesaian selesai.
- Penggantian masuk sebagai unit baru melalui Barang masuk dan QC, dengan tautan ke retur. Refund adalah penerimaan uang tersendiri; pengurangan utang tidak boleh sekaligus dianggap kas masuk.
- Unit lama tetap ada dalam histori. Nilai stok, utang, dan klaim supplier harus mengikuti keadaan pada tanggal laporan.

### 6.11 Report

- Tab: Penjualan, Laba rugi, Arus kas, Piutang/utang, Persediaan, Garansi/retur, dan Pencatatan keuangan.
- Pencatatan keuangan mempertahankan biaya operasional, pendapatan lain, kerugian, serta daftar pembayaran dan koreksi milik pemilik.
- Filter rentang tanggal, kategori, status, dan metode pembayaran sesuai relevansi. Tampilkan detail sumber dan ekspor CSV dengan filter serta izin yang sama.
- Bedakan omzet, penerimaan uang, laba, uang muka, modal persediaan, kewajiban refund, dan klaim ke supplier.
- Penjualan setelah diskon dikurangi kredit retur yang disahkan. Kas berubah pada tanggal pembayaran/refund. DP dan pelunasan tidak menambah omzet lagi.
- HPP mengikuti unit yang dijual. Retur pelanggan membalik HPP asal saat kepemilikan unit diterima kembali; penurunan nilai dicatat terpisah agar tidak menggandakan rugi.
- Garansi yang tidak membatalkan penjualan mencatat biaya penanganan sesuai kebijakan, bukan otomatis membalik penjualan.
- Persediaan historis dihitung pada akhir periode. Angka Dasbor dan Report untuk periode serta definisi sama wajib cocok.

### 6.12 Pengaturan

- Tab Profil toko, Tampilan, Staf dan akses, Kebijakan garansi/retur, serta Audit.
- Tampilan memakai pengaturan tema saat ini. Pengaturan toko, saldo awal, staf, penonaktifan akun, dan reset oleh pemilik tetap tersedia dengan izin yang sama.
- Kebijakan garansi memiliki versi dan tanggal berlaku; perubahan tidak mengubah hak transaksi lama tanpa koreksi eksplisit.
- Audit merekam aktor, waktu, entitas, perubahan status/nilai, dan alasan koreksi. Pengguna biasa tidak dapat mengubah histori.

## 7. Alur lintas modul

1. **Pembelian:** Barang masuk difinalisasi → unit Menunggu QC → pemeriksaan → Lulus menjadi Siap dijual, atau Perlu perbaikan/Gagal masuk tindak lanjut.
2. **Penjualan:** Kasir memilih unit siap jual → pelanggan dan pembayaran → simpan atomik → invoice/bukti → unit Terjual → hak garansi jika berlaku → muncul di Riwayat pesanan.
3. **Pelunasan:** Riwayat pesanan/Pelanggan → pembayaran tambahan → bukti baru → piutang berkurang; omzet asal tetap.
4. **Garansi:** Riwayat pesanan/Pelanggan/Garansi → cek hak → klaim → pemeriksaan → perbaikan/penggantian atau pengajuan retur terpisah → selesai.
5. **Retur pelanggan:** Pesanan asal → pengajuan → pemeriksaan/persetujuan → terima unit ke karantina → kredit/refund sesuai hak → QC ulang sebelum penjualan kembali.
6. **Retur supplier:** Unit gagal QC → pengajuan → persetujuan → kirim → penyelesaian penggantian/pengurangan utang/refund → rekonsiliasi.
7. **Servis umum:** Riwayat pesanan, tab Servis → penerimaan dan estimasi → DP opsional → pekerjaan → invoice saat selesai → pelunasan.

Garansi dan retur pelanggan dapat saling terkait, tetapi bukan satu proses yang sama. Klaim perbaikan tidak otomatis membatalkan penjualan.

## 8. Pemetaan fungsi lama

| Area lama | Tujuan v2 |
| --- | --- |
| Ringkasan | Dasbor |
| Penjualan/form penjualan | Kasir untuk transaksi baru; Riwayat pesanan untuk histori/detail |
| Pelanggan | Pelanggan |
| Stok unit | Produk; penerimaan baru melalui Barang masuk; pemeriksaan melalui QC |
| Servis | Riwayat pesanan → Servis |
| Pembayaran | Detail pesanan/pelanggan untuk penerimaan terkait; Report untuk daftar dan koreksi pemilik |
| Keuangan | Report → Pencatatan keuangan |
| Laporan | Report |
| Staf | Pengaturan → Staf dan akses |
| Log perubahan | Pengaturan → Audit |
| Pengaturan/tema | Pengaturan, tetap memakai sistem tema lama |
| Invoice/bukti pembayaran | Detail pesanan dan histori pembayaran, dengan izin dokumen yang sama |

Pencarian global diperbarui agar hasil lama menuju lokasi baru dan dapat mencari entitas baru sesuai izin. Tautan dokumen yang sudah diterbitkan tetap valid.

## 9. Data dan konsistensi

Entitas tambahan usulan: `Product`, `Supplier`, `GoodsReceipt`, `GoodsReceiptItem`, `QCInspection`, `QCResult`, `WarrantyPolicyVersion`, `WarrantyEntitlement`, `WarrantyClaim`, `CustomerReturn`, `CustomerReturnItem`, `SupplierReturn`, `SupplierReturnItem`, `StockMovement`, dan `AdjustmentDocument`. Pembayaran/refund serta penyesuaian utang/piutang memakai relasi sumber yang eksplisit. ERD rinci dibuat pada tahap rancangan teknis.

- Satu identitas unit fisik tetap sepanjang siklusnya; penggantian fisik membuat unit baru. Identitas item penjualan tetap tersedia meskipun MVP hanya menjual satu unit.
- Pisahkan status kepemilikan, ketersediaan stok, hasil QC, proses retur, dan pembayaran. Jangan memakai satu status `Retur` untuk semua keadaan.
- Semua perubahan stok berasal dari peristiwa sumber dan histori pergerakan; tidak ada pengeditan stok bebas.
- Nominal rupiah disimpan sebagai integer atau representasi presisi tetap. Validasi batas, relasi toko, dan transisi status dilakukan server-side.
- Setiap finalisasi yang memengaruhi beberapa entitas harus atomik dan aman terhadap pengiriman ulang. Unit tidak boleh dijual bersamaan, diretur dua kali, atau di-refund melebihi hak.
- Invoice dan bukti pembayaran lama tidak dihapus. Penyesuaian memiliki dokumen, sumber, aktor, waktu, serta alasan.

## 10. Migrasi dan urutan pengerjaan

1. **Baseline:** dokumentasikan tampilan/login aktual, izin, skema, saldo, jumlah record, serta tautan dokumen; buat backup database dan uji restore pada salinan.
2. **Rancangan teknis:** perbarui ERD dan workflow, definisikan matriks transisi serta perhitungan retur, lalu buat migrasi database yang dapat diuji pada salinan data.
3. **Navigasi dan pemetaan:** bangun sidebar 12 menu dan pindahkan akses fungsi lama ke tujuan v2 tanpa mengubah design system/login. Modul yang belum tersedia tidak ditampilkan seolah sudah berfungsi pada rilis akhir.
4. **Barang dan transaksi:** Produk, supplier, Barang masuk, QC, Kasir, Riwayat pesanan, serta Pelanggan.
5. **Purnajual:** Garansi, Retur pelanggan, Retur supplier, dokumen penyesuaian, dan integrasi stok/pembayaran.
6. **Pelaporan dan verifikasi:** Report, Dasbor, pencarian, izin, migrasi, serta uji alur menyeluruh.

Aturan migrasi:

- Pertahankan seluruh ID historis serta snapshot invoice/bukti. Jangan reset akun, password, session, atau preferensi tampilan.
- Supplier berupa teks lama tidak otomatis digabung tanpa peninjauan. Model produk lama juga memerlukan pemetaan yang tidak menyatukan varian berbeda.
- Unit siap jual lama tidak otomatis kehilangan status karena belum punya QC digital. Tandai sebagai data historis dengan sumber/status asal; QC wajib diberlakukan pada penerimaan dan retur baru.
- Status `Retur` lama masuk daftar peninjauan; jangan mengarang tanggal refund, jenis retur, persetujuan supplier, atau pergerakan kas.
- Hak garansi transaksi lama tidak dibuat dengan durasi tebakan. Tandai Belum ditentukan sampai pemilik memasukkan kebijakan/bukti yang sesuai.
- Rekonsiliasi stok, piutang, kas, dan laba sebelum/sesudah migrasi. Selisih harus punya pemetaan atau koreksi yang dapat dijelaskan sebelum rilis.

## 11. Kebutuhan antarmuka dan kualitas

- Gunakan ulang komponen saat ini; halaman baru menyediakan kondisi memuat, kosong, gagal, berhasil, dan tidak berwenang.
- Tabel mendukung pencarian, filter, sorting, pagination, dan menu aksi sesuai izin. Kode unit, nomor dokumen, serta nominal dapat dibaca lengkap.
- Form menyimpan input ketika validasi gagal, menandai kesalahan dekat field, mencegah submit berulang, dan menjelaskan dampak finalisasi stok/uang.
- Akses keyboard, focus terlihat, label kontrol, indikator aktif, serta reduced motion wajib tersedia.
- Verifikasi desktop 1440px dan seluler 390px pada light/dark mode. Tidak ada overflow halaman yang menghalangi tindakan utama; tabel lebar dapat memiliki area scroll lokal.
- Riwayat finansial dan audit tidak dihapus. Ekspor serta dokumen mengikuti izin baca sumbernya.
- Tidak mengubah aplikasi lokal menjadi deployment produksi dalam lingkup PRD ini.

## 12. Skenario penerimaan

| ID | Skenario | Hasil wajib |
| --- | --- | --- |
| AC-01 | Pemilik membuka aplikasi | Sidebar berisi 12 label dalam urutan bagian 4; halaman dan tab detail menandai induk yang benar. |
| AC-02 | Login/setup dan tema dibandingkan baseline | Field, validasi, alur, akun, session, serta preferensi tetap bekerja; token visual global tidak berubah. |
| AC-03 | Penerimaan baru difinalisasi | Unit unik tercipta Menunggu QC; belum bisa dijual; submit ulang tidak menduplikasi penerimaan. |
| AC-04 | Unit gagal lalu diperbaiki dan lulus QC ulang | Seluruh hasil tersimpan; hanya hasil lulus terbaru yang memenuhi syarat jual. |
| AC-05 | Dua sesi menjual unit sama | Hanya satu transaksi berhasil; sesi lain mendapat pesan dan input lain tetap tersedia. |
| AC-06 | Penjualan Rp3.000.000, diskon Rp100.000, DP Rp1.000.000 | Tagihan Rp2.900.000, sisa Rp1.900.000; satu invoice dan satu bukti; pelunasan membuat bukti kedua tanpa menambah omzet. |
| AC-07 | Tunai lunas tagihan Rp2.900.000 dengan tender Rp3.000.000 | Kembalian Rp100.000; pembayaran tercatat Rp2.900.000, bukan Rp3.000.000. |
| AC-08 | Klaim atas penjualan bergaransi | Hak, cakupan, tenggat, pemeriksaan, dan tindakan dapat dilacak; klaim bukan otomatis retur/refund. |
| AC-09 | Retur penuh AC-06 sebelum pelunasan | Kredit Rp2.900.000 menghapus piutang Rp1.900.000 dan menghasilkan kewajiban refund Rp1.000.000; kas turun hanya ketika refund dibayar. |
| AC-10 | Unit retur pelanggan diterima | Unit masuk karantina; tidak bisa dijual sampai QC lulus; penjualan asal dan dokumen tetap tersimpan. |
| AC-11 | Retur supplier diselesaikan dengan unit pengganti | Unit lama tetap bersejarah, unit baru melalui penerimaan/QC, tidak ada kas masuk fiktif. |
| AC-12 | Kasir/staf servis mencoba URL/API owner-only | Server menolak, termasuk data modal/laba, ekspor, pencarian, serta dokumen terkait. |
| AC-13 | Data lama dimigrasi | Jumlah record dan saldo dapat direkonsiliasi; invoice lama masih terbuka; tidak ada garansi atau refund hasil tebakan. |
| AC-14 | Servis lama dilanjutkan melalui Riwayat pesanan | Estimasi, DP, penyelesaian, invoice, pelunasan, serta izin staf servis tetap berfungsi. |
| AC-15 | Periode sama dibuka di Dasbor dan Report | Penjualan, retur, piutang, kas, serta laba memakai sumber dan definisi sama. |
| AC-16 | Semua menu diakses pada seluler dan keyboard | Semua menu yang diizinkan dapat dijangkau; focus/aktif terbaca pada kedua mode tema. |
| AC-17 | Kasir dibuka pada desktop | Katalog berada di kiri dan keranjang pada sidebar kanan; navigasi utama tetap di kiri; panel transaksi tetap terjangkau saat katalog digulir. |
| AC-18 | Harga awal Rp7.000.000 diedit menjadi Rp6.800.000 | Ringkasan memakai Rp6.800.000 sebelum diskon; harga katalog/modal tidak berubah; invoice menyimpan harga transaksi final. |
| AC-19 | Pengguna memilih Marketplace lalu menyimpan penjualan | Kanal Marketplace tersimpan dan terbaca di riwayat/laporan; tidak menyiratkan integrasi marketplace eksternal. |
| AC-20 | Keranjang kosong atau kuantitas unit berserial diubah | Simpan diblokir saat kosong; unit fisik yang sama tidak dapat memiliki kuantitas lebih dari 1. |
| AC-21 | Kasir dibuka pada lebar 390px | Katalog dan keranjang ditumpuk; harga manual, pelanggan, serta pembayaran tetap dapat digunakan tanpa overflow halaman. |
| AC-22 | Riwayat pesanan dibuka pada desktop | Filter berada di atas; kartu transaksi di kiri dan detail transaksi terpilih di kanan, memakai design system yang ada. |
| AC-23 | Kanal, status, rentang tanggal, dan pencarian diterapkan | Hasil hanya memuat transaksi yang cocok dan diizinkan; hasil kosong mengosongkan detail; rentang terbalik ditolak. |
| AC-24 | Pesanan memiliki DP Rp1.000.000 lalu pelunasan Rp1.900.000 | Dua entri dan dua bukti terlihat; total dibayar Rp2.900.000 dan sisa nol; cetak ulang tidak menambah pembayaran. |
| AC-25 | Pembayaran dikoreksi atau retur memiliki refund | Histori asli/koreksi tetap terlihat; pembayaran dibalik tidak dihitung; refund ditampilkan terpisah dengan dokumen sumber. |
| AC-26 | Pengguna seluler membuka detail lalu kembali | Filter dan posisi daftar dipertahankan; detail serta cetak nota/bukti dapat digunakan tanpa dua kolom sempit. |

Validasi implementasi mencakup suite `npm test` yang sudah ada, tes integrasi transisi stok/garansi/retur/refund dan idempotensi baru, uji migrasi pada salinan database, serta pemeriksaan visual baseline login/design system. Dokumen PRD sendiri tidak mengubah atau menjalankan transaksi.

## 13. Asumsi dan keputusan produk yang belum ditetapkan

Arahan yang sudah pasti adalah perombakan setelah login, pengecualian design system/login, sidebar navigasi referensi, serta layout Kasir dengan katalog di kiri dan panel keranjang di kanan sesuai referensi tambahan. Rincian berikut adalah usulan awal, bukan kebijakan toko yang telah dikonfirmasi.

| Keputusan | Usulan awal PRD | Dampak bila berbeda |
| --- | --- | --- |
| Cakupan “semuanya” | Seluruh halaman operasional dan alur terkait, dengan data dan fungsi lama dipertahankan | Perlu menyusun ulang prioritas bila hanya navigasi yang dimaksud |
| Transaksi banyak unit | Satu unit per transaksi pada MVP | Banyak unit membutuhkan model order/header-item dan perubahan invoice/perhitungan |
| Letak servis | Tab Servis dalam Riwayat pesanan | Bisa disesuaikan tanpa menambah menu utama |
| Durasi/cakupan garansi | Ditetapkan pemilik per kebijakan; tidak ada durasi bawaan yang ditebak | Menentukan kelayakan klaim dan snapshot hak |
| Tenggat/syarat retur pelanggan | Ditetapkan pemilik sebelum alur retur dirilis | Menentukan kelayakan, pengecualian, dan otorisasi |
| Bentuk penyelesaian retur | MVP kredit retur dan refund; tukar lintas produk ditunda | Tukar barang membutuhkan transaksi pengganti dan penghitungan selisih |
| Wewenang QC | Staf servis memeriksa; pemilik mengawasi; QC wajib untuk unit baru | Perlu mengubah izin bila petugas gudang/role baru dibutuhkan |
| Supplier dan pembelian | Direktori supplier di Barang masuk; pencatatan penerimaan tanpa purchase order | Purchase order/persetujuan pembelian menjadi lingkup tambahan |
| Garansi transaksi lama | Peninjauan manual berdasarkan bukti | Hindari menjanjikan hak yang tidak pernah diberikan |

Keputusan yang masih terbuka tidak menghalangi penyusunan struktur halaman dan pemetaan fungsi. Implementasi kebijakan garansi/retur harus mengikuti keputusan toko, bukan angka atau syarat buatan pengembang.

## 14. Di luar lingkup awal

Multi-cabang, pembelian dengan purchase order lengkap, stok sparepart terintegrasi, tukar tambah, saldo kredit pelanggan, integrasi payment gateway, pengiriman pesan otomatis, akuntansi pajak formal, migrasi framework, serta publikasi produksi. Fitur ini tidak disimpulkan hanya dari keberadaan menu pada gambar.

## 15. Definisi selesai

Perombakan selesai ketika 12 modul dapat digunakan sesuai izin dan alur yang disepakati, fungsi lama punya tujuan yang dapat diakses, skenario penerimaan lulus, migrasi dapat direkonsiliasi, serta login dan design system lolos perbandingan dengan baseline. Implementasi MVP kini tersedia; cakupan yang telah dibangun, pengujian, dan perluasan yang masih ditunda dicatat di [V2.md](V2.md).
