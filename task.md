# Checklist Pengerjaan Perbaikan Alur Tahap & Penyalinan File JONG WBTb

- [x] **Fase 1: Perbaikan Frontend (UI & Tombol Aksi)**
  - [x] Batasi render tombol "+ Catatan Penilai" di tabel Semua Usulan Operator di [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html)
  - [x] Tambah safeguard kelayakan usulan di `bukaFormCatatanPenilai` di [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html)
  - [x] Tambah tombol "Tandai Selesai Revisi" untuk Operator saat status `Diperbaiki` di `tampilModalDetailOperator` di [jong_wbtb_frontend.html](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_frontend.html)

- [x] **Fase 2: Perubahan Struktur Folder & Inisialisasi**
  - [x] Pastikan folder `ARSIP-VERSI` dibuat untuk subfolder Video di `buatSubfolderJenis` di [jong_wbtb_folder_structure.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_folder_structure.js)
  - [x] Implementasikan helper `getActiveStageKey` di [jong_wbtb_folder_structure.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_folder_structure.js)
  - [x] Implementasikan fungsi `copyActiveFilesToStage` di [jong_wbtb_folder_structure.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_folder_structure.js)

- [x] **Fase 3: Integrasi Alur Penyalinan di Backend**
  - [x] Panggil penyalinan berkas saat Atasan ACC (`Persetujuan Internal`) di `changeStatus()` di [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js)
  - [x] Panggil penyalinan berkas saat usulan ditangguhkan (`STATUS.DITANGGUHKAN`) di `changeStatus()` di [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js)
  - [x] Panggil penyalinan berkas saat usulan final (`STATUS.FINAL`) di `changeStatus()` di [jong_wbtb_state_machine.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_state_machine.js)
  - [x] Panggil penyalinan berkas saat revisi dibuka (`entryCatatanPenilai`) di [jong_wbtb_catatan_penilai.js](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/jong_wbtb_catatan_penilai.js)

- [x] **Fase 4: Verifikasi & Pembaruan Dokumentasi**
  - [x] Uji coba seluruh alur pengiriman, ACC, revisi, selesai revisi, dan penangguhan
  - [x] Perbarui dokumen [walkthrough.md](file:///c:/Users/ASUS/Documents/JONG%20WBTB%20GAS%20WEB%20APP/walkthrough.md)
