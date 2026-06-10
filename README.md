# RTK Rental ERP - Demo Prototype

Ini adalah clone prototype mandiri (self-contained) dari RTK Rental ERP yang siap didemokan untuk seluruh alur bisnis dari awal sampai akhir. Prototype ini dilengkapi dengan database temporer, data dummy yang kaya (untuk visualisasi grafik analytics dan histori calendar), berkas KYC terunggah placeholder, serta simulasi IoT GPS Tracker yang berjalan otomatis.

## Cara Menjalankan Prototype

1. Buka terminal Anda (Command Prompt, PowerShell, atau terminal VS Code).
2. Pindah ke direktori `Prototype` (atau biarkan di workspace utama jika menggunakan workspace ini).
3. Jalankan server dengan perintah:
   ```bash
   cd Prototype
   npm run start
   ```
4. Buka browser Anda dan akses:
   * **Storefront Customer**: [http://localhost:3001](http://localhost:3001)
   * **Dashboard Admin / Staff**: [http://localhost:3001/admin.html](http://localhost:3001/admin.html)

---

## Alur Skenario Demo (Step-by-Step)

Untuk mendemokan aplikasi dari awal sampai akhir secara komprehensif, gunakan skenario berikut:

### 1. Registrasi & Proteksi KYC
* Masuk ke **Storefront Customer** ([http://localhost:3001](http://localhost:3001)).
* Klik tombol **Masuk / Daftar** di kanan atas navbar, lalu masuk ke tab **Daftar Akun Baru**.
* Buat akun baru dengan email sembarang (misal: `demo@example.com`).
* Setelah berhasil mendaftar, coba masukkan salah satu kamera ke keranjang dan klik **Checkout**.
* **Hasil Demo**: Sistem akan memblokir proses checkout dan memunculkan notifikasi bahwa akun Anda belum terverifikasi KYC. Hal ini menunjukkan kepatuhan keamanan data.

### 2. Unggah Dokumen KYC
* Buka menu dropdown profil Anda di navbar, lalu pilih **Profil & KYC**.
* Unggah foto KTP dan foto Selfie Anda (atau klik area dropzone untuk menggunakan berkas gambar dummy yang otomatis dibuat).
* Klik **Kirim Dokumen KYC**. Status akun Anda akan berubah menjadi **Menunggu Verifikasi**.
* Coba checkout lagi — sistem tetap akan memblokir karena berkas Anda belum disetujui admin.

### 3. Persetujuan KYC oleh Admin
* Buka **Dashboard Admin** ([http://localhost:3001/admin.html](http://localhost:3001/admin.html)).
* Login menggunakan kredensial dummy:
  * **Username**: `admin`
  * **Password**: `rtk2024admin`
* Perhatikan tab **Verifikasi KYC** di sidebar kiri (memiliki badge indikator jumlah berkas pending).
* Klik tab tersebut, Anda akan melihat data customer yang baru Anda daftarkan beserta foto dokumen KTP & Selfie yang diunggah.
* Klik tombol **Setujui** untuk memverifikasi customer tersebut.

### 4. Transaksi & Simulasi Gerbang Pembayaran (QRIS / VA)
* Kembali ke **Storefront Customer** (lakukan refresh/cek profil Anda, statusnya kini sudah **Terverifikasi (KYC Sukses)**).
* Lakukan checkout belanjaan kamera Anda. Isian data diri customer sekarang terkunci (read-only) karena telah diverifikasi.
* Pilih durasi tanggal sewa, lalu klik **Konfirmasi Sewa**.
* Anda akan diarahkan ke **Gerbang Pembayaran Simulasi**.
* Pilih metode pembayaran **QRIS** (akan muncul kode QR dinamis dengan countdown timer) atau **Virtual Account**.
* Klik tombol **Simulasi Bayar Sukses** untuk menyelesaikan pembayaran tanpa perantara WhatsApp.

### 5. Pelacakan GPS IoT Real-time
* Setelah pembayaran dikonfirmasi, status booking otomatis berubah menjadi **Dikonfirmasi** (`status: "confirmed"`).
* Buka **Dashboard Admin** kembali pada tab **GPS Monitoring**.
* Di sini, Anda akan melihat tas kamera pesanan Anda terdaftar sebagai **IoT Active** di wilayah Tangerang/BSD.
* Peta Leaflet akan memperbarui posisi marker kamera secara live setiap 8 detik (mensimulasikan pergerakan kurir atau tas sewaan di lapangan). Anda dapat mengklik marker untuk melihat detail dan link WhatsApp penyewa.

### 6. Keuangan & Analytics Chart
* Buka tab **Keuangan & Laporan** di Dashboard Admin.
* Berkat data dummy yang kaya (35+ transaksi pra-seeding selama 6 bulan terakhir), Anda akan disajikan grafik batang interaktif (Chart.js) untuk:
  * Tren Omzet bulanan.
  * Distribusi status penyewaan.
  * 5 Produk kamera yang paling sering disewa.
* Anda juga dapat menguji ekspor laporan keuangan ke format **Excel/CSV** atau cetak **PDF Invoice** dari salah satu transaksi di tab Laporan.

---

## Detail Data Dummy Bawaan

* **Akun Admin**: `admin` / `rtk2024admin`
* **Akun Staff**: `staff` / `rtk2024staff` (tidak dapat mengakses tab analisis keuangan)
* **Customer Bawaan (Sudah Verified)**:
  * **Email**: `ahmad@example.com`
  * **Password**: `ahmad123`
* **Customer Bawaan (Pending KYC)**:
  * **Email**: `siti@example.com`
  * **Password**: `siti123`
