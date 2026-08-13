<div align="center">

# DeepSeek Harness Desktop

**Shell desktop Electron native untuk Web GUI DeepSeek Harness yang berjalan secara lokal.**

Jalankan layanan lokal dalam jendela khusus dengan proses memulai, menghubungkan, mengonfigurasi, dan memperbarui yang lebih terprediksi.

[![Release](https://img.shields.io/github/v/release/iuikj/dsh-desktop?display_name=tag&label=Release&color=4d6bfe)](https://github.com/iuikj/dsh-desktop/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/iuikj/dsh-desktop/build.yml?label=Build&logo=github)](https://github.com/iuikj/dsh-desktop/actions)
[![License](https://img.shields.io/badge/license-MIT-4d6bfe)](../package.json)

[简体中文](../README.md) · [English](./README.en.md) · [Bahasa Indonesia](./README.id.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

</div>

> **DeepSeek Harness Desktop bukan pengganti DeepSeek Harness.** Aplikasi ini mendeteksi dan terhubung ke layanan web DSH lokal. Jika belum ada layanan yang berjalan, aplikasi dapat memakai Node.js sistem dan jalur resmi `npx` untuk menjalankannya, sesuai konfigurasi lokal.

## Ikhtisar

DeepSeek Harness Desktop membungkus Web GUI lokal yang umumnya tersedia di `http://127.0.0.1:3080` ke dalam jendela desktop mandiri. Aplikasi ini ditujukan bagi pengguna yang ingin mempertahankan alur kerja DSH berbasis browser sambil memperoleh kemudahan desktop seperti penyimpanan posisi jendela, akses tray, status saat memulai, dan log lokal.

| Area | Kemampuan yang tersedia |
| --- | --- |
| **Koneksi dan mulai** | Mendeteksi layanan DSH yang sudah ada; dapat memulai layanan jika belum ditemukan; memilih port kosong saat port terkonfigurasi dipakai proses non-DSH. |
| **Alur pertama kali** | Memeriksa Node.js dan DSH; saat pemasangan otomatis diizinkan, mengambil runtime melalui `npx @deepseek-ai/dsh`. |
| **Pengalaman desktop** | Bilah judul kustom tanpa bingkai, ukuran dan posisi jendela tersimpan, perlindungan satu instans, akses tray, serta opsi meminimalkan ke tray. |
| **Observabilitas** | Umpan balik saat memulai, opsi mencoba lagi setelah galat, serta `logs/dsh-server.log` di direktori data pengguna Electron. |
| **Pembaruan dan rilis** | Build paket dapat memeriksa pembaruan GitHub Release; push tag `v*` memicu alur build dan rilis Windows. |

## Persyaratan

Aplikasi memerlukan **instalasi Node.js sistem, termasuk `npm` dan `npx`**. DSH menggunakan modul native yang dibangun untuk runtime Node.js sistem; Node.js bawaan Electron bukan pengganti yang sesuai. Saat pertama dibuka, aplikasi desktop memeriksa ketersediaan DSH dan, sesuai konfigurasi, dapat mengunduh atau memulai layanan.

| Komponen | Persyaratan | Keterangan |
| --- | --- | --- |
| Node.js | Wajib | `node` dan `npx` harus tersedia dari lingkungan sistem. |
| DeepSeek Harness | Dapat diperoleh otomatis | Instalasi yang ditemukan akan digunakan langsung; jika tidak ada, aplikasi dapat mengambilnya dengan jalur resmi `npx`. |
| Sistem operasi | Windows direkomendasikan | CI menerbitkan pemasang dan ZIP Windows. Validasi target paket lain sebelum didistribusikan. |

## Mulai Cepat

Unduh build yang sesuai dari [Releases](https://github.com/iuikj/dsh-desktop/releases) lalu instal. Saat pertama dibuka, aplikasi menampilkan kemajuan startup dan memuat alamat DSH lokal secara otomatis setelah layanan siap.

Untuk menjalankan dari kode sumber, gunakan perintah berikut. Pembaruan otomatis tidak diperiksa pada mode pengembangan.

```bash
npm install
npm start
```

| Situasi | Tindakan yang disarankan |
| --- | --- |
| Halaman startup tetap terlihat | Pastikan `node` dan `npx` tersedia, periksa log, lalu pilih **Retry**. |
| DSH sudah berjalan | Aplikasi desktop terhubung setelah mengonfirmasi layanan tersebut adalah DSH; instans duplikat tidak akan dibuat. |
| Port yang dikonfigurasi sedang digunakan | Aplikasi memilih port yang tersedia dan menyimpan nilai baru ke konfigurasi lokal. |
| Layanan perlu tetap berjalan di latar belakang | Aktifkan `minimizeToTray`; penutupan jendela akan menyembunyikan aplikasi ke tray sistem. |

## Konfigurasi

Saat pertama dibuka, aplikasi membuat `config.json` di direktori data pengguna Electron. Buka berkas tersebut dari **Help → Open Configuration Folder**. Kolom jalur yang kosong menggunakan hasil deteksi otomatis aplikasi.

```json
{
  "host": "127.0.0.1",
  "port": 3080,
  "autoStart": true,
  "autoInstallDsh": true,
  "killOnQuit": true,
  "minimizeToTray": false,
  "locale": "",
  "workspace": "",
  "nodePath": "",
  "dshBin": ""
}
```

| Pengaturan | Nilai awal | Tujuan |
| --- | --- | --- |
| `host` / `port` | `127.0.0.1` / `3080` | Alamat dengar untuk layanan DSH lokal. |
| `autoStart` | `true` | Memulai DSH bila layanan yang ada tidak terdeteksi. |
| `autoInstallDsh` | `true` | Mengizinkan pengambilan DSH melalui `npx` saat tidak ditemukan. |
| `killOnQuit` | `true` | Menghentikan hanya proses layanan yang **dimulai oleh aplikasi ini**. |
| `minimizeToTray` | `false` | Menyembunyikan aplikasi ke tray, bukan keluar, saat jendela ditutup. |
| `locale` | `""` | Mengikuti lokal sistem saat kosong; UI desktop saat ini mendukung bahasa Mandarin dan Inggris. |
| `workspace` | `""` | Direktori kerja DSH; memakai direktori rumah pengguna saat kosong. |
| `nodePath` / `dshBin` | `""` | Menggantikan jalur Node.js atau entri DSH yang dideteksi otomatis. |

## Build dan Rilis

Proyek menggunakan Electron Builder. Perintah berikut membuat build tanpa paket untuk pemeriksaan dan artefak distribusi.

```bash
# Membuat build tanpa paket untuk pemeriksaan cepat
npm run pack

# Membuat pemasang dan artefak ZIP
npm run dist
```

GitHub Actions membangun pemasang dan ZIP Windows ketika tag `v*` didorong, lalu melampirkannya pada Release yang sesuai. Validasikan platform yang relevan sebelum membuat tag produksi.

## Batas Privasi dan Keamanan

Alamat layanan bawaan adalah alamat loopback `127.0.0.1`. Aplikasi memblokir pembukaan jendela tersemat baru dan meneruskan tautan biasa `http`/`https` ke peramban sistem. Log layanan disimpan lokal di direktori data pengguna; periksa informasi ruang kerja atau lingkungan sebelum membagikannya.

> DeepSeek Harness, dependensinya, layanan model, dan data terkait akun diatur oleh kebijakan penyedia masing-masing. Tinjau dokumentasi serta pemberitahuan privasi terkait sebelum digunakan.

## Kontribusi

Kontribusi melalui Issue dan Pull Request sangat diterima. Jaga perubahan tetap terfokus, jelaskan cara verifikasinya, dan jangan melakukan commit atas log, artefak build, atau kredensial.

```bash
git clone https://github.com/iuikj/dsh-desktop.git
cd dsh-desktop
npm install
npm start
```

## Ucapan Terima Kasih

Terima kasih kepada rekan-rekan di [LINUX DO](https://linux.do/) atas dukungan dan masukan mereka.

---

<div align="center">

**DeepSeek Harness Desktop** · Pintu masuk desktop yang mengutamakan lokal

</div>
