# Riwayat Pengembangan Sistem: JONG WBTB GAS WEB APP

Dokumen ini berisi rekam jejak lengkap evolusi, pembaruan, perbaikan, dan keputusan desain dari sistem **JONG WBTb** (Jaringan Online Pengelolaan Warisan Budaya Takbenda) dari fase awal konsep hingga pengerjaan sesi terbaru. Disusun berdasarkan log repositori Git, transkrip percakapan pengembangan (23 sesi), dan catatan walkthrough yang ada.

**Penyusun:** Fattahul Fahmi, S.T. — Pranata Komputer Ahli Pertama, Dinas Kebudayaan Kabupaten Lingga

---

## Fase 0 — Perancangan & Pengembangan Awal Sistem (23 Mei – 2 Juni 2026)

Sistem JONG WBTb mulai dirancang dan dikembangkan oleh Fattahul Fahmi sebagai bagian dari proyek aktualisasi Latsar CPNS. Pada fase ini:

* **Stack Teknologi Dipilih:**
  - Backend: Google Apps Script (GAS) v8 — terdiri dari 11 file `.gs`
  - Frontend: Single-file HTML + CSS (awalnya menggunakan Tailwind CSS)
  - Database: Google Sheets (`db_wbtb_lingga`, `db_users`, `db_activity_log`)
  - Penyimpanan Berkas: Google Drive (terstruktur per folder usulan)
  - Deploy: GAS Web App (Execute as User, Anyone with Google Account)

* **Arsitektur Inti Dibangun:**
  - Sistem Role-Based Access Control (RBAC) dengan 3 peran: **Atasan** (Dwi Rossatifa, SE), **Operator** (Fattahul Fahmi, S.T.), dan **Anggota Tim** (Aminullah Budi, S.Pd & Andri Palesama, A.Md.Sn)
  - State Machine dengan 6 status resmi: `Sedang Dikerjakan`, `Persetujuan Internal`, `Diperbaiki`, `Dilanjutkan`, `Final`, `Ditangguhkan`
  - Struktur folder Google Drive otomatis per tahapan usulan
  - Sistem penamaan file terstandarisasi (`jong_wbtb_naming.js`)
  - Validasi input (`jong_wbtb_validation.js`), retensi data (`jong_wbtb_retensi.js`), arsip versi (`jong_wbtb_arsip_versi.js`)

* **Dokumen Pendukung Dipersiapkan:**
  - Dokumen Rancangan Sistem (`Dokumen_Rancangan_Sistem_JONG_WBTb_v1.0.docx`)
  - Dokumen Teknis Sistem (`JONG_WBTb_Dokumen_Teknis_Sistem_v1.0.docx`)
  - Juknis WBTb 2026 Revisi 2 sebagai acuan regulasi

* **Testing Awal Berhasil:**
  - Login semua peran (Atasan, Operator, Anggota Tim) ✅
  - Buat Usulan Baru ✅
  - Upload kajian/foto/video ✅
  - Kirim ke Atasan ✅
  - Verifikasi Atasan (ACC/Kembalikan) ✅
  - Entry Catatan Penilai ✅
  - Kelola Akses, Arsip Historis, Log Aktivitas ✅

---

## Sesi 1 — 3 Juni 2026: Integrasi dengan Antigravity IDE & Perbaikan Pertama

Ini merupakan sesi pertama pengembangan bersama Antigravity IDE. Seluruh kode sumber yang telah dibangun sebelumnya diintegrasikan ke dalam workspace.

* **Konteks:** Sistem sudah di-deploy dan berjalan di GAS. Sesi ini fokus pada perbaikan dan penyempurnaan berdasarkan hasil uji coba lapangan.
* **Pekerjaan:**
  - Mempelajari keseluruhan 11 file `.gs` dan file frontend HTML
  - Memperbaiki fungsi `arsipVideoUrl` agar sesuai dengan helper penamaan standar `namaFile()`
  - Menyesuaikan alur deployment step-by-step di Apps Script editor
  - Menyusun rencana implementasi awal (implementation plan) yang disetujui pengguna

---

## Sesi 2 — 4 Juni 2026: Konfirmasi Progres & Lanjutan

* Membaca ulang seluruh file `.md` dan walkthrough untuk menyinkronkan konteks
* Melanjutkan pekerjaan dari rencana yang sudah disetujui sebelumnya

---

## Sesi 3 — 5 Juni 2026 (Dini Hari): Upload Git, ACC Badge, Skenario Revisi Handshake

Sesi panjang dan produktif (25 pesan pengguna), mencakup beberapa milestone penting:

### 3a. Inisialisasi Repository Git & GitHub
* Menginisialisasi repositori Git lokal dan menghubungkan ke GitHub (`fahmifattahul/jong-wbtb-gas-web-app`)
* Initial commit mencakup 22 file (11.524 baris kode)
* Melakukan pembersihan file sensitif (docx, pdf, txt) dari GitHub sambil mempertahankannya di lokal

### 3b. Fitur ACC Badge
* Menambahkan badge persetujuan (ACC) berwarna hijau yang tampil di semua tampilan (dashboard, workspace, semua usulan) saat usulan telah di-ACC oleh Atasan
* Memperbaiki error syntax nested backticks di template literals

### 3c. Skenario Uji Coba Lengkap
* **Skenario Entry Catatan Penilai** — diuji step-by-step, berhasil
* **Skenario Ganti Dokumen Drive** — ditemukan bug pada proses ganti file kajian dan foto oleh anggota; diperbaiki
* **Skenario Handshake Revisi (Anggota ↔ Operator):**
  - Awalnya gagal: tombol "Tandai Selesai Revisi" di akun Operator tidak muncul
  - Pengguna mengidentifikasi kelemahan desain: *bagaimana Operator tahu kapan waktu yang tepat untuk menekan tombol?*
  - **Solusi:** Menambahkan kolom baru `is_revisi_selesai` (kolom ke-26) pada database. Anggota Tim harus mengklik **"Kirim Hasil Perbaikan"** terlebih dahulu, baru kemudian tombol **"Tandai Selesai Revisi"** muncul di sisi Operator
  - Catatan Penilai Eksternal otomatis disembunyikan setelah revisi diterima kembali, namun tetap tersimpan di Drive untuk keterlacakan
* Seluruh perubahan di-commit dan di-push ke GitHub

---

## Sesi 4 — 5 Juni 2026 (Pagi): Skenario Kembalikan & Naik Versi Dokumen

Sesi pengujian intensif (65 pesan pengguna) yang menguji skenario-skenario kritis:

### 4a. Skenario "Kembalikan untuk Diperbaiki" oleh Atasan
* Awalnya gagal: setelah dikembalikan, usulan tidak muncul kembali di Workspace Anggota dengan status yang benar
* Bug diperbaiki dan diverifikasi berhasil

### 4b. Skenario Naik Versi File
* Ditemukan bug: file versi lama (`_v1`) berhasil dipindahkan ke subfolder `ARSIP-VERSI`, namun duplikat file baru tidak diberi nama yang benar
* Perbaikan dilakukan pada `jong_wbtb_arsip_versi.js`

### 4c. Skenario Transisi ke Penetapan & Final
* Implementasi tombol **"Tandai Dilanjutkan"** — mengopi seluruh berkas aktif dari `02_PENGUSULAN` ke `04_PENETAPAN`
* Implementasi tombol **"Tandai Final (Lolos Penetapan)"** — mengopi berkas dari `04_PENETAPAN` ke `06_FINAL`
* Otomatis membuat folder `PRESENTASI` (di tahap Penetapan & Final) dan `SERTIFIKAT` (di tahap Final)
* Folder utama otomatis terkunci menjadi Read-Only saat status Final

### 4d. Upload Presentasi & Sertifikat
* Endpoint baru: `uploadPresentasi` (PDF/PPT/PPTX) dan `uploadSertifikat` (PDF)
* Endpoint hapus: `deletePresentasiFile` dan `deleteSertifikatFile`
* UI list presentasi & sertifikat di workspace dan halaman verifikasi Atasan

### 4e. Perbaikan Tombol "Lihat" File di Drive
* *Masalah:* Tombol "Lihat ↗" pada berkas presentasi gagal membuka file — akibat sandbox iframe Google
* *Diagnosis:* Dibuat skrip debug standalone `runDebugProposal()` di `jong_wbtb_debug.js`
* *Solusi Final:* Mengubah semua 6 tombol "Lihat" dari `<a href target="_blank">` menjadi `<button onclick="window.open(...)">` — **berhasil 100%**

### 4f. Eksperimen Modularisasi & Rollback
* Dicoba memecah `jong_wbtb_frontend.html` (4.200+ baris) menjadi 12 modul JS terpisah menggunakan `<?!= include('...'); ?>`
* **Dibatalkan total (Rolled Back)** karena:
  - Error UTF-8 BOM dari PowerShell `Set-Content -Encoding UTF8`
  - Kompleksitas pemeliharaan 12 file di GAS editor
* Sistem dikembalikan ke file tunggal yang stabil

---

## Sesi 5 — 5 Juni 2026 (Malam): Instalasi Python, Checkpoint & Persiapan Fitur Baru

Sesi terpanjang (106 pesan pengguna), meliputi:

* **Instalasi Python:** Pengguna menginstal Python di laptop agar skrip pendukung bisa dijalankan
* **Checkpoint kode** sebelum fitur "Operator merangkap Anggota" (commit `2e925b3`)
* **File baru: `jong_wbtb_arsip_ui.html`** — UI khusus untuk pengelolaan arsip historis (953 baris baru)
* **Penambahan besar di `jong_wbtb_endpoints.js`** — 705 baris tambahan/modifikasi untuk endpoint-endpoint baru
* **Perampingan frontend** — refactoring dan optimasi `jong_wbtb_frontend.html` (636 baris perubahan)
* **Fitur "Saling Peduli"** — Akses transparan agar Anggota Tim bisa melihat detail seluruh usulan tim tanpa error "Akses ditolak"
* **Validasi Keamanan Backend** — pengecekan hak tulis (*ownership* + status kunci folder) pada fungsi: `buatFormulirProposal`, `naikVersiFormulir`, `uploadKajian`, `uploadFoto`, `simpanVideoUrl`
* **Fungsi `kunciFolderDrive`** diperkuat agar robust terhadap error izin Drive

---

## Sesi 6 — 6 Juni 2026 (Pagi): Pertanyaan Desain & Neubrutalism

* Pengguna bertanya apakah desain menggunakan Tailwind CSS
* Memulai perombakan besar gaya visual antarmuka ke **Neubrutalism (RawBlock Vibe)**

---

## Sesi 7 — 6 Juni 2026 (Siang): Rombak Total Visual ke Neubrutalism

Sesi ini fokus pada identitas visual:

* **Overhaul ke Neobrutalism:** 422 baris ditambah, 271 dihapus pada frontend
* **Gaya "Melayu Lingga":** Skema warna berani — Mustard (`#fcc603`), Cyan (`#38c7bd`), Grapefruit, Blue
* **Detail UI:**
  - Border tegas 2px solid, bayangan tajam 3px/2px, sudut membulat 8px
  - Sidebar putih solid dengan latar Charcoal (`#1A1A1A`)
  - Logo boks hijau berteks gold/putih
* **Custom Dropdown:** Mengganti `<select>` bawaan browser dengan dropdown kustom bergaya neubrutalist
* **Pembersihan Komentar:** Sempat menghapus komentar verbose dari 13 file, kemudian di-**revert** karena komentar tetap dibutuhkan

---

## Sesi 8 — 6 Juni 2026 (Siang): Landing Page GitHub Pages & Custom Domain

* **Masalah:** URL web app GAS terlalu panjang dan tidak profesional
* **Solusi:** Membuat landing page GitHub Pages (`github-pages/index.html` dan `404.html`) yang men-embed web app dalam iframe
* **Explorasi opsi custom domain** gratis via Netlify/Vercel sebagai wrapper redirect
* **Pembuatan dokumen desain:** `neubrutalism-DESIGN.md` dan `rawblock-DESIGN.md`

---

## Sesi 9 — 6 Juni 2026 (Sore): Debugging Akses Anggota Baru & Perbaikan UI

* **Bug:** Anggota baru yang emailnya sudah ditambahkan via web app tetap gagal mengakses
* **Solusi:** Memastikan mekanisme penambahan akses berjalan dengan benar
* **Perbaikan dropdown terpotong** di menu Semua Usulan, Arsip Historis, dan Log Aktivitas
* **Perbedaan GitHub Pages vs Deploy langsung:** Perubahan tidak langsung terlihat di GitHub Pages karena caching

---

## Sesi 10 — 6 Juni 2026 (Sore): Review Audit Teknis

* **Membaca dan memahami** dokumen `jong_wbtb_lampiran_audit_teknis_v3.pdf`
* **Analisis relevansi** terhadap kode sistem yang ada — tanpa melakukan perubahan kode

---

## Sesi 11 — 6 Juni 2026 (Malam): Bug Kritis ID Duplikat & Perbaikan UI Atasan

Sesi debugging kritis (14 pesan pengguna):

* **Bug serius:** Saat mengklik usulan "TES REVISI" dari list, yang terbuka malah usulan "Faris" — karena **ID proposal duplikat** di database
* **Akar masalah:** Sistem tidak melakukan pengecekan ID maksimal sebelum membuat ID baru. Ditambah pengguna melakukan edit manual di sheet
* **Solusi:** Memperbarui `jong_wbtb_database.js` agar men-lookup max ID dan mencegah duplikasi
* **Perbaikan hak upload Presentasi:** Sempat diizinkan untuk Anggota Tim sebagai PJ, lalu direstriksi kembali hanya untuk peran Operator
* **Tampilan "no-formulir" untuk Atasan:** Menampilkan placeholder yang benar saat formulir belum dibuat
* **Penyesuaian terminologi evaluasi:** "Evaluasi Kepatuhan Bulanan" → "Evaluasi Kelengkapan Progres Usulan", "Verifikasi Mandiri" → "Verifikasi Kelengkapan Mandiri"
* **UI Akordeon Atasan:** Menggunakan `<details>` & `<summary>` dalam container scrollable untuk menampilkan hasil evaluasi kelengkapan

---

## Sesi 12 — 7 Juni 2026 (Malam): Pembuatan Dokumen & Slide Presentasi

* **Dokumen Teknis Diperbarui:** `Rancangan_Sistem.txt` dan `Teknis_Sistem.txt` — menghapus nomor versi/tanggal, menyeragamkan penyusun, memperbarui skema database dari 24 ke 27 kolom
* **Panduan Pengguna:** Menyusun `Panduan_Pengguna.txt` — gaya ramah, bebas istilah teknis berlebih, dengan nama personel nyata (Ibu Dwi, Bpk. Fahmi, Bpk. Ami, Bpk. Andri)
* **Slide Presentasi Sharing Session:** Membuat `Presentasi_Sharing_Session.html` — 12 slide interaktif:
  - Dark mode, aspek rasio 16:9, navigasi keyboard/swipe
  - Progress bar, URL configurator (roda gigi ⚙️)
  - Mockup simulasi interaktif (editor Google Docs, file uploader, checklist, dsb.)
  - Dukungan cetak PDF via `@media print`

---

## Sesi 13 — 7 Juni 2026 (Malam Lanjutan): Perbaikan Klik Presentasi di Chrome

* **Masalah:** Semua interaksi klik pada kartu presentasi tidak berfungsi di Google Chrome
* **Penyebab:** Chrome memblokir eksekusi `onclick` inline pada file lokal (`file:///`) demi keamanan sandbox
* **Solusi Terintegrasi:**
  - Menghapus semua atribut `onclick` inline
  - Menggunakan `addEventListener` terprogram pada `DOMContentLoaded`
  - Menambahkan CSS `pointer-events: none` pada elemen anak kartu
* **Mockup Screenshot:** Membuat 4 gambar placeholder PNG untuk modal presentasi
* **Penuhkan tampilan modal** agar layak dipresentasikan di layar besar

---

## Sesi 14 — 7 Juni 2026 (Malam Akhir): Bug Sandbox iframe pada Formulir

* **Masalah:** Membuat formulir baru gagal saat diakses via GitHub Pages, padahal dari Apps Script langsung bisa
* **Solusi:** Menghapus atribut sandbox pada `app-frame` iframe agar Google Docs bisa di-embed (nested) tanpa hambatan

---

## Sesi 15 — 8 Juni 2026 (Dini Hari): Responsivitas Mobile

* **Masalah:** Tampilan rusak total saat dibuka di handphone — padahal diasumsikan sudah responsif
* **Solusi:** Mengimplementasikan responsive mobile menu dan memperbaiki isu scroll tabel
* **Perubahan:** 55 baris ditambah, 9 dihapus — termasuk hamburger menu, media queries, dan horizontal scroll pada tabel data

---

## Sesi 16 — 9 Juni 2026 (Malam): Manajemen Akses Email Teman & Custom Domain

* **Pertanyaan:** Bagaimana cara menambah akses (role) untuk email teman
* **Solusi:** Membatasi akses email tertentu lewat kode (RBAC enforcement)
* **Eksplorasi Custom Domain:** Diskusi tentang merapikan URL web app GAS yang panjang — mempertimbangkan Vercel, Netlify, dan GitHub Pages sebagai opsi redirect/wrapper gratis

---

## Sesi 17 — 9 Juni 2026 (Malam Lanjutan): Upload Formulir .docx & Proteksi Judul Ganda

* **Fitur Konversi Formulir (.docx → Google Docs):**
  - Validasi tipe file (.docx/.doc) dan batas ukuran 15MB (`validateFileFormulir`)
  - Fungsi `convertDocxToGoogleDoc` — upload ke Drive dan konversi via multipart upload Drive API v3
  - Endpoint `uploadFormulirPertama` — validasi, upload, konversi, sharing, update database
  - Tombol "Unggah Formulir (.docx)" di workspace Anggota Tim

* **Proteksi Judul Duplikat:**
  - Fungsi `checkDuplicateTitle` — pencocokan *case-insensitive* Nama Karya & Judul Singkat
  - Dihubungkan ke `createProposal`, `importArsipHistoris`, `editArsipHistoris`
  - Jika duplikat terdeteksi → pendaftaran dibatalkan + toast merah

* **Penyempurnaan Total UX Loading:**
  - **Interseptor Global `gasCall`:** Setiap klik tombol otomatis di-disable + spinner tanpa overlay layar penuh
  - **Modal Konfirmasi Asinkron:** Tombol "Ya, Lanjutkan" menunggu (await) callback sebelum tutup
  - **Upload Progress Lokal:** Indikator loading di tab masing-masing, bukan layar penuh hijau
  - **Penghapusan Total `showLoading`/`hideLoading`** dari semua fungsi tombol interaktif — loading screen hijau hanya muncul sekali saat inisialisasi awal aplikasi

---

## Sesi 18 — 12 Juni 2026: Debugging Proses Penangguhan yang Lambat

* **Masalah:** Saat Atasan menekan tombol "Ditangguhkan", sistem loading sangat lama — proses pemindahan usulan ke folder ditangguhkan memakan waktu berlebih
* **Investigasi & Perbaikan:** Mengoptimalkan proses penyalinan berkas agar lebih efisien tanpa mengubah pesan konfirmasi yang sudah ada

---

## Sesi 19 — 13 Juni 2026: Restrukturisasi Hak Akses Status Transisi

Sesi strategis berdasarkan arahan langsung dari Atasan (19 pesan pengguna):

* **Permintaan Kritis dari Atasan:** Tombol dan fungsi **"Ditangguhkan"** dipindahkan dari peran Atasan ke peran **Operator** saja
* **Rasional Bisnis:** Keputusan menangguhkan, merevisi, atau melanjutkan usulan ditentukan berdasarkan **surat eksternal** yang masuk ke instansi terkait seleksi — bukan keputusan sepihak Atasan
* **Pembagian Wewenang Baru:**
  - **Atasan:** Murni verifikasi internal — hanya ACC atau Kembalikan
  - **Operator:** Mengelola seluruh transisi status operasional (Dilanjutkan, Ditangguhkan, dll.) berdasarkan surat eksternal yang masuk
* **Perubahan State Machine:** Merestrukturisasi aturan transisi status agar sesuai pembagian wewenang baru

---

## Sesi 21 — 13–14 Juni 2026: Peningkatan UI/UX & Perbaikan Batas Upload

### 21a. UX: Tombol Aksi di Bagian Atas Halaman
* **Latar Belakang:** Atasan sering tidak menyadari tombol "ACC" dan "Kembalikan" ada di bawah halaman saat meninjau usulan
* **Solusi:** Memindahkan tombol aksi Atasan ke bagian **atas halaman** (card header), di samping tombol "← Kembali"
* **File diubah:** `jong_wbtb_frontend.html`

### 21b. Peningkatan Batas Upload Foto
* **Masalah:** Batas 5 MB per foto tidak efisien — Kementerian memprioritaskan foto berkualitas tinggi
* **Analisis Keamanan GAS Payload:** Batas 50 MB GAS dengan Base64 inflate ~33% → batas aman 30 MB total batch
* **Perubahan:**
  - Batas per file foto: **5 MB → 10 MB**
  - Batas total batch foto: tetap **30 MB** (aman untuk GAS payload limit)
  - Label tombol upload diperbarui: "maks. 5MB" → "maks. 10MB"
* **Validasi berlapis tetap dipertahankan:** Frontend (UX) + Backend `jong_wbtb_validation.js` (keamanan) — keduanya diperbarui konsisten
* **File diubah:** `jong_wbtb_frontend.html`, `jong_wbtb_validation.js`

### 21c. Peningkatan Kosmetik Dashboard (Permintaan Atasan)
* Atasan menyatakan dashboard "terlalu banyak warna putih"
* **Perubahan visual yang dilakukan:**
  - Latar belakang halaman utama: kuning *mustard* (`var(--mustard-50)`)
  - 4 *Card* metrik (Total, Dikerjakan, Revisi, Ditetapkan): warna pastel unik per card (biru, amber, merah muda, cyan)
  - Header tabel data: hitam → hijau lumut gelap (`var(--cyan-900)`)
  - *Zebra striping* pada baris tabel ganjil/genap
  - Efek *hover* baris tabel: abu → kuning mustard
  - Sidebar dikembalikan ke putih agar tidak bertabrakan warna dengan latar kuning
* **File diubah:** `jong_wbtb_frontend.html`

---

## Sesi 22 — 14 Juni 2026: UX Verifikasi Mandiri & Perbaikan Tab

### 22a. UX: Verifikasi Kelengkapan Mandiri di Bagian Atas
* **Masalah:** Setelah klik "Kirim ke Atasan", panel Verifikasi Kelengkapan Mandiri muncul di bawah halaman (setelah tab konten yang panjang)
* **Solusi:**
  - Memindahkan elemen `#ws-verifikasi-card` ke posisi atas `ws-detail` (setelah header card, sebelum tabs)
  - Mengubah scroll dari `window.scrollTo({top:0})` (tidak berfungsi di GAS iframe) ke `card.scrollIntoView({behavior:'smooth'})` yang lebih reliable
  - Menambahkan border hijau emerald pada card verifikasi agar terlihat menonjol
* **Menghilangkan Duplikasi Tombol:** Saat panel verifikasi muncul, tombol "Kirim ke Atasan" di header disembunyikan otomatis; muncul kembali saat klik "Batal"
* **Perbaikan: Card tidak hilang setelah kirim berhasil** — menambahkan `tutupVerifikasi()` sebelum `bukaWsProposal()` di fungsi `kirimKeAtasan()`
* **File diubah:** `jong_wbtb_frontend.html`

### 22b. Perbaikan Sinkronisasi Batas Upload Foto di Backend
* **Masalah:** Setelah batas frontend dinaikkan ke 10 MB, backend `jong_wbtb_validation.js` masih menolak file >5 MB dengan pesan error
* **Akar Masalah:** Perubahan sebelumnya hanya mengubah validasi *frontend* (UX), bukan validasi *backend* (keamanan server)
* **Perbaikan:** Konstanta `FILE_LIMITS.FOTO_BYTES` di `jong_wbtb_validation.js` diperbarui dari `5MB` → `10MB`, termasuk pesan error yang ditampilkan
* **File diubah:** `jong_wbtb_validation.js`

### 22c. Perbaikan Tab Aktif Setelah Upload
* **Masalah:** Setiap kali upload kajian, foto, atau simpan URL video berhasil, halaman refresh dan selalu kembali ke tab "Formulir"
* **Akar Masalah:** `renderWsDetail` selalu memanggil `switchWsTab('formulir')` secara *hardcode*
* **Solusi — Parameter `returnTab`:** Menambahkan parameter opsional `returnTab` ke fungsi `bukaWsProposal(proposalId, returnTab)` dan `renderWsDetail(p, returnTab)`. Setiap handler upload meneruskan nama tab tujuan langsung sebagai parameter (lebih reliable daripada variabel global yang rawan *race condition* di GAS iframe)
* **Cakupan perbaikan:** Upload kajian → kembali ke tab `kajian`; upload/hapus foto → tab `foto`; simpan/hapus video → tab `video`
* **File diubah:** `jong_wbtb_frontend.html`

---

## Ringkasan Statistik Proyek

| Metrik | Nilai |
|---|---|
| Periode Pengembangan | 23 Mei – 14 Juni 2026 (~3 minggu) |
| Jumlah Sesi Pengembangan | 22+ sesi |
| Total Commit Git | 32+ commit |
| File Kode Utama | 11 file backend `.js` + 1 file frontend `.html` + 1 file arsip UI `.html` |
| Ukuran Frontend | ~5.510 baris (jong_wbtb_frontend.html ≈ 210KB) |
| Ukuran Backend | ~110KB (jong_wbtb_endpoints.js) |
| Database | Google Sheets — 26 kolom |
| Pengguna Aktif | 4 akun (1 Atasan, 1 Operator, 2 Anggota Tim) |
