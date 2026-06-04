# Walkthrough Perubahan & Pengujian JONG WBTb (Versi 2.0)

Dokumen ini menjelaskan detail perubahan kode terbaru yang diimplementasikan untuk memperbaiki masalah editabilitas dokumen selama masa verifikasi, penambahan fitur ganti/edit video, penyempurnaan alur ACC Atasan, serta pembatasan entry Catatan Penilai Eksternal.

---

## Perubahan Kode yang Dilakukan

### 1. Database Schema & Auto-Migration
*   **File**: [jong_wbtb_database.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_database.js)
*   **Perubahan**:
    *   Menambahkan kolom baru `IS_APPROVED_BY_ATASAN` pada index `24` (kolom ke-25).
    *   Meningkatkan `TOTAL_COLS_WBTB` menjadi `25` dan memperbarui `HEADERS_WBTB`.
    *   Menambahkan logika auto-migrasi pada `initializeDatabase()` agar otomatis mendeteksi jika spreadsheet lama memiliki kolom kurang dari 25, lalu secara otomatis menambahkan header `"is_approved_by_atasan"` ke kolom ke-25 pada Google Sheet.

### 2. Backend Logic & Endpoints
*   **File**: [jong_wbtb_endpoints.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_endpoints.js)
*   **Perubahan**:
    *   Menginisialisasi `rowData[COL.IS_APPROVED_BY_ATASAN] = false` pada `createProposal()`.
    *   Menginisialisasi `rowData[COL.IS_APPROVED_BY_ATASAN] = true` pada `createArsipHistoris()`.
    *   Menambahkan properti `isApprovedByAtasan` dalam payload objek kembalian di `getProposalDetail()`.

### 3. State Machine Transition Logic
*   **File**: [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js)
*   **Perubahan**:
    *   Memperbarui fungsi `changeStatus()` untuk mengelola transisi nilai `is_approved_by_atasan`:
        *   Jika `keStatus === STATUS.PERSETUJUAN_INTERNAL` dan dieksekusi oleh `ROLES.ATASAN` (Atasan klik ACC), flag ini diset menjadi `true`.
        *   Jika status berubah ke status draf (`Sedang Dikerjakan` atau `Diperbaiki`) atau dikirim ulang oleh Anggota Tim, flag ini otomatis di-reset ke `false`.

### 4. Frontend UI & Alur Koordinasi
*   **File**: [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html)
*   **Perubahan**:
    *   **Fungsi Helper `isWorkspaceEditable(p)`**: Membuat fungsi global untuk mengecek apakah usulan dalam status draf (`Sedang Dikerjakan` atau `Diperbaiki`) dan tidak dikunci (`!driveLocked`).
    *   **Formulir (Google Doc)**: Mengunci iframe menjadi mode `preview` (hanya-lihat) jika usulan tidak dalam mode draf/editabel.
    *   **Kajian Ilmiah & Foto**: Menyembunyikan tombol Ganti/Hapus dan area unggah jika dokumen dalam mode hanya-lihat.
    *   **Video Dokumentasi**:
        *   Menambahkan ID pada pembatas dan container form video.
        *   Menyembunyikan form input video jika statusnya hanya-lihat.
        *   Jika dalam mode draf dan video sudah terisi, form input tetap terbuka dan teks tombol simpan berubah secara dinamis menjadi **Ganti URL Video** agar mempermudah koreksi tautan video.
    *   **Catatan Penilai (Operator)**: Membatasi dropdown pilihan usulan agar Operator hanya bisa menginput catatan penilai untuk usulan berstatus `Diperbaiki` atau usulan `Persetujuan Internal` yang **sudah di-ACC oleh Atasan** (`isApprovedByAtasan === true`).
    *   **Keputusan Verifikasi (Atasan)**: Menyembunyikan tombol keputusan verifikasi (ACC/Kembalikan/Tangguhkan) dan menampilkan banner sukses hijau jika usulan tersebut sudah berhasil disetujui (ACC) sebelumnya.

---

## Langkah Deploy Ulang ke Google Apps Script Web App

Perubahan kode lokal ini harus diunggah dan dideploy ulang ke Google Apps Script proyek JONG WBTb Anda:
1.  Buka browser dan buka proyek Apps Script Anda di Google Drive.
2.  Buka file-file berikut di editor Apps Script Anda:
    *   `jong_wbtb_database.gs` -> Ganti isinya dengan isi dari file lokal [jong_wbtb_database.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_database.js).
    *   `jong_wbtb_endpoints.gs` -> Ganti isinya dengan isi dari file lokal [jong_wbtb_endpoints.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_endpoints.js).
    *   `jong_wbtb_state_machine.gs` -> Ganti isinya dengan isi dari file lokal [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js).
    *   `jong_wbtb_frontend.html` -> Ganti isinya dengan isi dari file lokal [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html).
3.  Klik tombol **Save** (Ctrl+S) untuk menyimpan semua file.
4.  Lakukan deploy ulang (New Version):
    *   Klik **Deploy** -> **Manage deployments**.
    *   Pilih deployment aktif Anda, klik ikon pensil (Edit).
    *   Pada dropdown **Version**, pilih **New Version**.
    *   Klik **Deploy**.
5.  *(Opsional)* Jalankan sekali fungsi `initializeDatabase()` dari editor Apps Script untuk memperbarui struktur kolom Google Sheets Anda agar kolom ke-25 terbuat secara otomatis.

---

## Langkah Verifikasi Hasil Perubahan (Manual Verification)

Lakukan pengujian berikut setelah web app dideploy untuk memastikan semua fitur berjalan lancar:

### Skenario 1: Uji Coba Mode Hanya-Lihat (Anggota Tim)
1.  Login ke Web App sebagai **Anggota Tim**.
2.  Buka detail usulan aktif yang berstatus `Sedang Dikerjakan`. Pastikan dokumen bisa diedit dan tombol edit/ganti aktif.
3.  Klik **Kirim ke Atasan →** dan kirimkan usulan (status berubah ke `Persetujuan Internal`).
4.  Buka kembali detail usulan tersebut.
5.  **Verifikasi**:
    *   Dokumen Google Docs berubah menjadi mode **preview** (tidak bisa diedit).
    *   Tombol "Ganti" dan "Hapus" pada tab Kajian Ilmiah & Foto menghilang.
    *   Form input URL Video di tab Video tersembunyi sepenuhnya.

### Skenario 2: Uji Coba Ganti URL Video (Anggota Tim)
1.  Buka usulan berstatus `Sedang Dikerjakan` (draf).
2.  Buka tab **Video**. Pastikan form input URL video tampil.
3.  Masukkan tautan video salah lalu klik **Simpan URL Video**.
4.  Setelah tersimpan, perhatikan tombol simpan berubah menjadi **Ganti URL Video**.
5.  Masukkan tautan video yang benar, klik **Ganti URL Video**.
6.  **Verifikasi**: URL video berhasil ter-update ke data yang baru.

### Skenario 3: Uji Coba Verifikasi Atasan & Logika Catatan Penilai (Atasan & Operator)
1.  Login sebagai **Atasan** (`natbkdisbudlingga@gmail.com`).
2.  Buka halaman **Verifikasi Usulan** -> Pilih usulan berstatus `Persetujuan Internal` tadi.
3.  Klik **Setujui (ACC)** -> **Ya, Setujui Usulan Ini**.
4.  Setelah disetujui, halaman akan kembali ke daftar verifikasi. Klik kembali usulan tadi.
5.  **Verifikasi**: Panel keputusan verifikasi digantikan oleh banner hijau bertuliskan **"Usulan Disetujui (ACC)"**.
6.  Login sebagai **Operator** (`fahmifattahul@gmail.com`).
7.  Buka halaman **Catatan Penilai**.
8.  **Verifikasi**:
    *   Usulan yang statusnya `Persetujuan Internal` tetapi **belum di-ACC** Atasan **tidak muncul** dalam daftar pilihan.
    *   Usulan yang statusnya `Persetujuan Internal` dan **sudah di-ACC** Atasan **muncul** di daftar pilihan.
9.  Pilih usulan yang sudah di-ACC tadi, input catatan revisi (format poin bernomor), lalu simpan.
10. Login kembali sebagai **Anggota Tim**. Buka detail usulan tersebut.
11. **Verifikasi**: Status berubah menjadi `Diperbaiki`, putaran revisi naik ke `P01`, catatan dari penilai eksternal tampil di bagian atas, dan seluruh tombol editabilitas dokumen kembali aktif (*enable*).

---

## Update: Hotfix Bug Stuck Loading Screen

*   **Masalah**: Setelah deployment, web app stuck di loading screen "Memuat sistem..." dengan error `Uncaught SyntaxError: Unexpected end of input` di console browser.
*   **Penyebab**: Terdapat kurung kurawal penutup `}` yang terlewat/hilang pada fungsi `renderVerDetail(p)` (tepat sebelum `kembaliKeDaftarVerifikasi()`), sehingga javascript parser mendeteksi akhir file tidak lengkap (unclosed function).
*   **Solusi**: Menambahkan kurung kurawal penutup `}` yang hilang pada baris 3587-3588 di [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html) agar fungsi `renderVerDetail(p)` tertutup dengan sempurna.
*   **Tindakan Pengguna**: Copy ulang seluruh konten [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html) terbaru, paste ke file `jong_wbtb_frontend.html` di Google Apps Script editor, simpan, dan deploy ulang (pilih **New Version**).

---

## Update: Pembatasan Tombol Tindakan Operator Sebelum ACC Atasan

*   **Masalah**: Saat usulan baru saja dikirim oleh Anggota ke Atasan (status `Persetujuan Internal` namun belum di-ACC Atasan), akun Operator masih bisa melihat tombol **+ Entry Catatan Penilai** dan **Tandai Dilanjutkan** pada modal detail usulan.
*   **Penyebab**: Fungsi `tampilModalDetailOperator(p)` di frontend hanya mengecek `p.status === 'Persetujuan Internal'` tanpa memverifikasi flag `p.isApprovedByAtasan`.
*   **Solusi & Perubahan**:
    1.  **Frontend**: Mengubah kondisi render tombol di [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html) (baris 2225 dan 2235) agar memvalidasi `p.status === 'Persetujuan Internal' && p.isApprovedByAtasan === true`.
    2.  **Backend**: Menambahkan pengecekan pengaman (*safeguard*) pada fungsi `changeStatus` di [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js) agar menolak perubahan status oleh Operator jika usulan berstatus `Persetujuan Internal` tersebut belum di-ACC oleh Atasan (`is_approved_by_atasan` masih `false`).
*   **Tindakan Pengguna**:
    1.  Copy seluruh isi file [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html) ke `jong_wbtb_frontend.html` di Google Apps Script editor Anda.
    2.  Copy seluruh isi file [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js) ke `jong_wbtb_state_machine.gs` di Google Apps Script editor Anda.
    3.  Klik **Save** (Ctrl+S) dan lakukan deploy ulang (**New Version**).

---

## Update: Otomatisasi Penyalinan File Antar Folder Tahap JONG WBTb

*   **Masalah**: Dokumen usulan aktif pada tahap sebelumnya tidak terdokumentasi di folder tahap baru secara otomatis saat terjadi perubahan status (Atasan ACC, revisi baru dibuka, usulan ditangguhkan, usulan final). Hal ini berisiko melanggar ketentuan *audit trail* Juknis jika dokumen asli terhapus atau berubah di folder awal.
*   **Solusi & Perubahan**:
    1.  **Struktur Folder & Versioning**:
        *   Memperbarui `buatSubfolderJenis()` di [jong_wbtb_folder_structure.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_folder_structure.js) agar subfolder `VIDEO-DOKUMENTASI` juga dibuatkan subfolder `ARSIP-VERSI` di dalamnya.
        *   Menambahkan fungsi helper `getActiveStageKey()` untuk mencocokkan status dan persetujuan usulan ke nama key tahap Google Drive.
        *   Mengimplementasikan fungsi core `copyActiveFilesToStage()` yang menyalin berkas aktif (Formulir, Kajian PDF, Foto, Video .txt) dari folder tahap asal ke folder tahap tujuan, lalu memperbarui record database dengan ID file baru. Fungsi ini mendukung eksekusi aman di dalam transaksi database spreadsheet aktif (`optSheetTx`).
    2.  **Integrasi State Machine**:
        *   Memodifikasi `changeStatus()` di [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js) untuk memicu `copyActiveFilesToStage()` ketika:
            *   Atasan klik ACC (Persetujuan Internal $\rightarrow$ Persetujuan Internal, Atasan).
            *   Usulan ditangguhkan (Status apa pun $\rightarrow$ Ditangguhkan).
            *   Usulan difinalisasi (Dilanjutkan $\rightarrow$ Final).
    3.  **Integrasi Putaran Revisi Baru & Catatan Penilai**:
        *   Memodifikasi `entryCatatanPenilai()` di [jong_wbtb_catatan_penilai.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_catatan_penilai.js) untuk memicu `copyActiveFilesToStage()` ke folder putaran revisi `03_REVISI/P[XX]` yang baru dibuat.
        *   Menambahkan fungsi untuk menyimpan file `CATATAN-PENILAI_P[XX].txt` ke subfolder `CATATAN` di putaran revisi tersebut dan mencatat `fileId` nya di database.
*   **Tindakan Pengguna**:
    1.  Copy seluruh isi file [jong_wbtb_folder_structure.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_folder_structure.js) ke `jong_wbtb_folder_structure.gs` di Apps Script.
    2.  Copy seluruh isi file [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js) ke `jong_wbtb_state_machine.gs` di Apps Script.
    3.  Copy seluruh isi file [jong_wbtb_catatan_penilai.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_catatan_penilai.js) ke `jong_wbtb_catatan_penilai.gs` di Apps Script.
    4.  Klik **Save** (Ctrl+S) dan lakukan deploy ulang (**New Version**).

---

## Update: Perbaikan Hak Akses Atasan (Editor) & Sinkronisasi UI Operator (Fix Skenario 2.2)

*   **Masalah (Skenario 2.2)**: 
    1.  File tidak tersalin ke `02_PENGUSULAN` saat Atasan ACC dan kolom berkas aktif di database tidak ter-update.
    2.  Tombol **+ Catatan Penilai** tidak muncul pada sisi Operator meskipun usulan sudah di-ACC Atasan (kolom 25 sudah bernilai `TRUE`).
    3.  Judul kolom ke-25 (`is_approved_by_atasan`) kosong/tidak tertulis di baris pertama spreadsheet.
*   **Penyebab Masalah**:
    1.  **Kendala Akses Drive**: Web app dideploy sebagai **"User accessing the web app"**. Saat Atasan ACC, script berjalan atas akun Atasan. Karena di `createProposal()` Atasan hanya diberi akses **Viewer**, Drive API melemparkan error *Access Denied* ketika Atasan mencoba menyalin berkas ke folder `02_PENGUSULAN`. Error ini ditangkap oleh block `try-catch` internal sehingga transaksi database sukses (kolom 25 diset `TRUE`), namun proses salin gagal.
    2.  **Missing Field in Summary**: Fungsi `getDashboardData()` menggunakan `buatProposalSummary()` untuk merender tabel usulan Operator. Di dalam `buatProposalSummary()`, properti `isApprovedByAtasan` terlewat/tidak dimasukkan, sehingga Operator membaca status approval sebagai `undefined`.
    3.  **Auto-Migration Check**: Logika migrasi sebelumnya bergantung pada `getLastColumn()`. Jika sheet memiliki kolom kosong bawaan Google Sheets, logika pendeteksian kolom baru tidak terpicu.
*   **Solusi & Perubahan**:
    1.  **Pemberian Akses Editor untuk Atasan**:
        *   Mengubah `folderKarya.addViewer(atasan.email)` menjadi `folderKarya.addEditor(atasan.email)` pada `createProposal()` di `jong_wbtb_endpoints.js` agar Atasan dapat melakukan salin berkas saat ACC.
        *   Menambahkan fungsi **Self-Healing** di `getDashboardData()` pada `jong_wbtb_endpoints.js`. Saat **Operator** membuka dashboard, sistem otomatis mendeteksi usulan berstatus `Persetujuan Internal` dan menambahkan hak akses **Editor** kepada Atasan secara aman & idempotent.
    2.  **Sistem Pengaman Rollback (Atomic Transaction)**:
        *   Mengubah try-catch di `copyActiveFilesToStage()` pada [jong_wbtb_folder_structure.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_folder_structure.js) agar melakukan **throw error** jika salin berkas kritikal (Formulir, Kajian, Foto, Video) gagal. Dengan begitu, jika terjadi masalah hak akses Drive, transaksi database akan **di-rollback** secara aman (status usulan tidak berubah menjadi sukses semu).
    3.  **Pembaruan Summary & UI**:
        *   Menambahkan field `isApprovedByAtasan` di dalam `buatProposalSummary()` pada [jong_wbtb_endpoints.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_endpoints.js).
        *   Menambahkan badge **ACC** berwarna hijau (`badge-success`) di samping badge status pada `renderSemuaUsulanRow(p)` di [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html) untuk penanda visual yang jelas.
    4.  **Perbaikan Auto-Migration**:
        *   Mengubah cek migrasi kolom 25 di `initializeDatabase()` pada [jong_wbtb_database.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_database.js) agar langsung mengecek teks isi cell header kolom ke-25 secara akurat.
*   **Tindakan Pengguna**:
    1.  Copy seluruh isi file [jong_wbtb_endpoints.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_endpoints.js) ke `jong_wbtb_endpoints.gs` di GAS.
    2.  Copy seluruh isi file [jong_wbtb_folder_structure.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_folder_structure.js) ke `jong_wbtb_folder_structure.gs` di GAS.
    3.  Copy seluruh isi file [jong_wbtb_database.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_database.js) ke `jong_wbtb_database.gs` di GAS.
    4.  Copy seluruh isi file [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html) ke `jong_wbtb_frontend.html` di GAS.
    5.  Klik **Save** (Ctrl+S) dan lakukan deploy ulang (**New Version**).
    6.  *(Sangat Penting)*: Buka Web App sekali menggunakan akun **Operator** agar rutin *Self-Healing* berjalan dan memberikan akses Editor kepada Atasan untuk usulan aktif saat ini. Setelah itu, silakan lakukan reset status/testing ulang Skenario 2.2.

---

## Update: Konsistensi Penanda ACC Hijau di Seluruh Tampilan

*   **Masalah**: Penanda (**badge**) hijau **ACC** saat usulan disetujui Atasan (`isApprovedByAtasan === true`) sebelumnya hanya muncul pada menu Semua Usulan di akun Operator. Di halaman lain (seperti Dashboard, Workspace Anggota Tim, Modal Detail, Catatan Penilai, dan Verifikasi Atasan), penanda ini tidak tampil di samping status `Persetujuan Internal`.
*   **Solusi & Perubahan**:
    *   Memperbarui [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html) untuk menampilkan badge **ACC** secara konsisten di samping badge status:
        1.  **Dashboard**: Tabel "Usulan Aktif" (`renderProposalRow(p)`).
        2.  **Workspace Anggota Tim**: Daftar Folder Usulan (`renderWsFolderList(proposals)`) dan Header Detail Workspace (`ws-acc-badge` & `renderWsDetail(p)`).
        3.  **Detail Operator**: Modal Detail Usulan (`mdo-acc-badge` & `tampilModalDetailOperator(p)`).
        4.  **Catatan Penilai**: Daftar Pemilihan Usulan (`renderCpPilihList(proposals)`).
        5.  **Verifikasi Atasan**: Daftar tunggu verifikasi (`renderVerDaftarList(proposals)`) dan Header Detail Verifikasi (`ver-acc-badge` & `renderVerDetail(p)`).
*   **Tindakan Pengguna**:
    1.  Copy seluruh isi file [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html) ke `jong_wbtb_frontend.html` di GAS.
    2.  Klik **Save** (Ctrl+S) dan lakukan deploy ulang (**New Version**).


