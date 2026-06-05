/**
 * JONG WBTb — Modul Retensi Arsip Ditangguhkan
 * Sesuai Juknis Tata Kelola Dokumen Digital WBTb 2026 Revisi 2
 * Bab IV huruf E
 *
 * ATURAN JUKNIS:
 * "Penghapusan dokumen merupakan kewenangan eksklusif Operator.
 *  Penghapusan hanya diperbolehkan terhadap dokumen yang berada dalam
 *  subfolder Arsip Ditangguhkan dan telah melampaui masa retensi
 *  satu (1) tahun sejak tanggal penetapan status Ditangguhkan."
 *
 * "Boleh" — bukan kewajiban. Sistem hanya notifikasi.
 * Keputusan dan eksekusi penghapusan sepenuhnya di tangan Operator.
 *
 * FLOW:
 * 1. Time-driven trigger jalan tiap bulan (setup manual di GAS editor)
 * 2. Sistem cek semua folder berstatus DITANGGUHKAN
 * 3. Folder yang sudah >= 1 tahun → kirim notifikasi email ke Operator
 * 4. Operator memutuskan sendiri apakah mau hapus atau tidak
 * 5. Jika Operator hapus → eksekusi via deleteArsipDitangguhkan()
 * 6. Setiap penghapusan wajib didokumentasikan & dilaporkan ke Atasan
 *
 * SCHEMA UPDATE:
 * Tambahkan kolom berikut ke db_wbtb_lingga di jong_wbtb_database.js:
 * DITANGGUHKAN_AT : 23  // Date | Tanggal status DITANGGUHKAN ditetapkan.
 *                       //       Diisi otomatis oleh changeStatus() saat status → DITANGGUHKAN.
 * Dan update TOTAL_COLS_WBTB dari 23 menjadi 24.
 * Dan tambahkan "ditangguhkan_at" ke HEADERS_WBTB.
 *
 * SETUP TRIGGER (manual di GAS editor):
 * Extensions → Apps Script → Triggers → Add Trigger:
 * - Function: cekRetensiArsipDitangguhkan
 * - Event source: Time-driven
 * - Type: Month timer
 * - Day: 1 (tanggal 1 tiap bulan)
 *
 * CATATAN DEVELOPER:
 * - Trigger ini berjalan atas akun Gmail yang deploy GAS
 * - Email notifikasi terkirim dari akun Gmail tersebut
 * - Jangan hapus trigger tanpa koordinasi dengan Operator
 */


// ─────────────────────────────────────────────
// 1. KONSTANTA RETENSI
// ─────────────────────────────────────────────

var RETENSI_HARI = 365; // 1 tahun = 365 hari


// ─────────────────────────────────────────────
// 2. HELPER: HITUNG SELISIH HARI
// ─────────────────────────────────────────────

/**
 * Menghitung selisih hari antara dua tanggal.
 *
 * @param {Date} tanggalAwal  - Tanggal awal
 * @param {Date} tanggalAkhir - Tanggal akhir (default: sekarang)
 * @returns {number}          - Selisih dalam hari (integer)
 */
function selisihHari(tanggalAwal, tanggalAkhir) {
  var akhir  = tanggalAkhir || new Date();
  var ms     = akhir.getTime() - new Date(tanggalAwal).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}


// ─────────────────────────────────────────────
// 3. CEK RETENSI — DIPANGGIL OLEH TRIGGER
// ─────────────────────────────────────────────

/**
 * Mengecek semua folder berstatus DITANGGUHKAN dan mengirim notifikasi
 * ke Operator untuk folder yang sudah melampaui masa retensi 1 tahun.
 *
 * Fungsi ini didaftarkan sebagai time-driven trigger bulanan.
 * Tidak perlu dipanggil manual kecuali untuk testing.
 */
function cekRetensiArsipDitangguhkan() {

  Logger.log("Memulai pengecekan retensi Arsip Ditangguhkan...");

  var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
  var data  = sheet.getDataRange().getValues();

  var folderLewatRetensi   = [];
  var folderMendekatiRetensi = []; // dalam 30 hari ke depan

  for (var i = 1; i < data.length; i++) {
    var row    = data[i];
    var status = row[COL.STATUS];

    if (status !== STATUS.DITANGGUHKAN) continue;

    var ditangguhkanAt = row[COL.DITANGGUHKAN_AT];
    if (!ditangguhkanAt) continue;

    var hariSejak = selisihHari(ditangguhkanAt);

    var item = {
      proposalId  : row[COL.ID],
      namaKarya   : row[COL.NAMA_KARYA],
      ditangguhkan: ditangguhkanAt,
      hariSejak   : hariSejak,
      sisaHari    : RETENSI_HARI - hariSejak
    };

    if (hariSejak >= RETENSI_HARI) {
      folderLewatRetensi.push(item);
    } else if (hariSejak >= RETENSI_HARI - 30) {
      // Peringatan dini 30 hari sebelum retensi habis
      folderMendekatiRetensi.push(item);
    }
  }

  Logger.log(
    "Hasil cek: " + folderLewatRetensi.length + " folder lewat retensi, " +
    folderMendekatiRetensi.length + " folder mendekati retensi."
  );

  // Kirim notifikasi jika ada yang perlu diinformasikan
  if (folderLewatRetensi.length > 0 || folderMendekatiRetensi.length > 0) {
    kirimNotifikasiRetensi(folderLewatRetensi, folderMendekatiRetensi);
  }

  writeAuditLog(
    ACTION_TYPES.RETENSI_CHECK,
    "Pengecekan retensi bulanan selesai. " +
    "Lewat retensi: " + folderLewatRetensi.length + ". " +
    "Mendekati retensi: " + folderMendekatiRetensi.length + ".",
    null
  );
}


// ─────────────────────────────────────────────
// 4. KIRIM NOTIFIKASI EMAIL
// ─────────────────────────────────────────────

/**
 * Mengirim email notifikasi retensi ke Operator aktif.
 *
 * @param {Array} lewatRetensi    - Folder yang sudah melampaui 1 tahun
 * @param {Array} mendekatiRetensi - Folder yang dalam 30 hari akan melampaui 1 tahun
 */
function kirimNotifikasiRetensi(lewatRetensi, mendekatiRetensi) {

  // Ambil email Operator aktif
  var semuaUser    = getAllActiveUsers(Session.getActiveUser().getEmail());
  var operatorList = semuaUser.operator;

  if (operatorList.length === 0) {
    Logger.log("Tidak ada Operator aktif — notifikasi tidak terkirim.");
    return;
  }

  var tanggalSekarang = Utilities.formatDate(
    new Date(), "Asia/Jakarta", "dd MMMM yyyy"
  );

  // Bangun isi email
  var bagianLewat = "";
  if (lewatRetensi.length > 0) {
    bagianLewat = "FOLDER YANG SUDAH MELAMPAUI MASA RETENSI 1 TAHUN:\n" +
      "(Dapat dihapus sesuai Juknis Bab IV huruf E — keputusan ada di tangan Operator)\n\n";
    lewatRetensi.forEach(function(item) {
      bagianLewat +=
        "- " + item.proposalId + " | " + item.namaKarya + "\n" +
        "  Ditangguhkan: " + Utilities.formatDate(new Date(item.ditangguhkan), "Asia/Jakarta", "dd MMMM yyyy") + "\n" +
        "  Sudah: " + item.hariSejak + " hari (" + Math.floor(item.hariSejak / 365 * 10) / 10 + " tahun)\n\n";
    });
  }

  var bagianMendekati = "";
  if (mendekatiRetensi.length > 0) {
    bagianMendekati = "FOLDER YANG AKAN MELAMPAUI MASA RETENSI DALAM 30 HARI:\n\n";
    mendekatiRetensi.forEach(function(item) {
      bagianMendekati +=
        "- " + item.proposalId + " | " + item.namaKarya + "\n" +
        "  Ditangguhkan: " + Utilities.formatDate(new Date(item.ditangguhkan), "Asia/Jakarta", "dd MMMM yyyy") + "\n" +
        "  Sisa: " + item.sisaHari + " hari\n\n";
    });
  }

  var isiEmail = [
    "Notifikasi Retensi Arsip Ditangguhkan — JONG WBTb",
    "Tanggal pengecekan: " + tanggalSekarang,
    "================================================================",
    "",
    bagianLewat,
    bagianMendekati,
    "================================================================",
    "Catatan:",
    "- Penghapusan adalah HAK Operator, bukan kewajiban (Juknis Bab IV huruf E).",
    "- Jika Operator memutuskan untuk menghapus, gunakan fitur",
    "  'Hapus Arsip Ditangguhkan' di sistem JONG WBTb.",
    "- Setiap penghapusan wajib dilaporkan kepada Atasan.",
    "- Email ini dikirim otomatis oleh sistem JONG WBTb setiap bulan.",
    "",
    "Sistem JONG WBTb",
    "Dinas Kebudayaan Kabupaten Lingga"
  ].join("\n");

  // Kirim ke semua Operator aktif
  operatorList.forEach(function(operator) {
    try {
      GmailApp.sendEmail(
        operator.email,
        "[JONG WBTb] Notifikasi Retensi Arsip Ditangguhkan — " + tanggalSekarang,
        isiEmail
      );
      Logger.log("Notifikasi terkirim ke: " + operator.email);
    } catch(e) {
      Logger.log("Gagal kirim email ke " + operator.email + ": " + e.toString());
    }
  });
}


// ─────────────────────────────────────────────
// 5. EKSEKUSI PENGHAPUSAN ARSIP DITANGGUHKAN
//
// Juknis Bab IV huruf E:
// - Kewenangan eksklusif Operator
// - Hanya untuk folder yang sudah >= 1 tahun
// - Setiap penghapusan wajib didokumentasikan
//   dan dilaporkan ke Atasan
// ─────────────────────────────────────────────

/**
 * Menghapus dokumen dalam subfolder Arsip Ditangguhkan untuk satu folder usulan.
 * Hanya bisa dieksekusi oleh Operator.
 * Folder harus sudah melampaui masa retensi 1 tahun.
 *
 * PENTING: Fungsi ini memindahkan file ke Google Drive Trash,
 * bukan permanent delete. Google Drive Trash dibersihkan otomatis
 * setelah 30 hari. Ini memberikan safety net jika Operator menyesal.
 *
 * @param {string} operatorEmail - Email Operator yang mengeksekusi
 * @param {string} proposalId    - ID usulan yang arsipnya akan dihapus
 * @returns {object}             - { proposalId, filesDihapus, tanggal }
 */
function deleteArsipDitangguhkan(operatorEmail, proposalId) {

  // ── Validasi aktor ────────────────────────
  requireRole(operatorEmail, ROLES.OPERATOR);

  // ── Ambil data proposal ───────────────────
  var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
  var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);

  if (!hasil) {
    throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan.");
  }

  var row    = hasil.rowData;
  var status = row[COL.STATUS];

  // ── Validasi status ───────────────────────
  if (status !== STATUS.DITANGGUHKAN) {
    throw new Error(
      "Penghapusan hanya boleh dilakukan pada folder berstatus DITANGGUHKAN. " +
      "Status saat ini: " + status + "."
    );
  }

  // ── Validasi retensi 1 tahun ──────────────
  var ditangguhkanAt = row[COL.DITANGGUHKAN_AT];
  if (!ditangguhkanAt) {
    throw new Error(
      "Tanggal penangguhan tidak tercatat. " +
      "Hubungi administrator sistem."
    );
  }

  var hariSejak = selisihHari(ditangguhkanAt);
  if (hariSejak < RETENSI_HARI) {
    throw new Error(
      "Masa retensi 1 tahun belum terpenuhi. " +
      "Folder baru ditangguhkan " + hariSejak + " hari yang lalu. " +
      "Penghapusan baru bisa dilakukan setelah " + (RETENSI_HARI - hariSejak) + " hari lagi."
    );
  }

  // ── Ambil folder Arsip Ditangguhkan di Drive ──
  var folderKaryaId  = row[COL.FOLDER_KARYA_ID];
  var folderKarya    = DriveApp.getFolderById(folderKaryaId);
  var iterArsipFolder = folderKarya.getFoldersByName(
    FOLDER_NAMES.TAHAP.ARSIP_DITANGGUHKAN
  );

  if (!iterArsipFolder.hasNext()) {
    throw new Error(
      "Subfolder " + FOLDER_NAMES.TAHAP.ARSIP_DITANGGUHKAN +
      " tidak ditemukan di folder karya ID: " + folderKaryaId
    );
  }

  var folderArsip  = iterArsipFolder.next();
  var filesDihapus = [];

  // ── Pindahkan semua file ke Trash ─────────
  var iterFiles = folderArsip.getFiles();
  while (iterFiles.hasNext()) {
    var file = iterFiles.next();
    filesDihapus.push({ fileId: file.getId(), nama: file.getName() });
    file.setTrashed(true);
  }

  // Hapus juga subfolder di dalam Arsip Ditangguhkan (jika ada)
  var iterSubfolders = folderArsip.getFolders();
  while (iterSubfolders.hasNext()) {
    var subfolder = iterSubfolders.next();
    // Hapus file di dalam subfolder dulu
    var iterSubFiles = subfolder.getFiles();
    while (iterSubFiles.hasNext()) {
      var subFile = iterSubFiles.next();
      filesDihapus.push({ fileId: subFile.getId(), nama: subFile.getName() });
      subFile.setTrashed(true);
    }
    subfolder.setTrashed(true);
  }

  var tanggalHapus = Utilities.formatDate(
    new Date(), "Asia/Jakarta", "dd MMMM yyyy"
  );

  // ── Audit log ─────────────────────────────
  writeAuditLog(
    ACTION_TYPES.ARSIP_VERSI_PINDAH, // reuse sebagai "penghapusan"
    "Arsip Ditangguhkan dihapus (dipindah ke Trash) untuk " + proposalId + ". " +
    "Total file: " + filesDihapus.length + ". " +
    "Hari sejak ditangguhkan: " + hariSejak + ". " +
    "Dieksekusi oleh Operator: " + operatorEmail,
    proposalId
  );

  // ── Kirim laporan ke Atasan ───────────────
  kirimLaporanPenghapusanKeAtasan(
    operatorEmail, proposalId, row[COL.NAMA_KARYA],
    filesDihapus, tanggalHapus, hariSejak
  );

  return {
    proposalId   : proposalId,
    filesDihapus : filesDihapus,
    tanggal      : tanggalHapus,
    totalFile    : filesDihapus.length
  };
}


// ─────────────────────────────────────────────
// 6. LAPORAN PENGHAPUSAN KE ATASAN
//
// Juknis Bab IV huruf E:
// Setiap penghapusan wajib didokumentasikan
// dan dilaporkan kepada Atasan.
// ─────────────────────────────────────────────

/**
 * Mengirim email laporan penghapusan ke Atasan aktif.
 *
 * @param {string} operatorEmail - Email Operator yang eksekusi
 * @param {string} proposalId    - ID usulan
 * @param {string} namaKarya     - Nama karya budaya
 * @param {Array}  filesDihapus  - Array { fileId, nama } file yang dihapus
 * @param {string} tanggalHapus  - Tanggal eksekusi penghapusan
 * @param {number} hariSejak     - Hari sejak folder ditangguhkan
 */
function kirimLaporanPenghapusanKeAtasan(operatorEmail, proposalId, namaKarya,
                                          filesDihapus, tanggalHapus, hariSejak) {

  var semuaUser  = getAllActiveUsers(operatorEmail);
  var atasanList = semuaUser.atasan;

  if (atasanList.length === 0) {
    Logger.log("Tidak ada Atasan aktif — laporan penghapusan tidak terkirim.");
    return;
  }

  var daftarFile = filesDihapus.map(function(f, idx) {
    return (idx + 1) + ". " + f.nama + " (ID: " + f.fileId + ")";
  }).join("\n");

  var isiEmail = [
    "Laporan Penghapusan Arsip Ditangguhkan — JONG WBTb",
    "================================================================",
    "",
    "Operator   : " + operatorEmail,
    "Tanggal    : " + tanggalHapus,
    "Proposal   : " + proposalId + " — " + namaKarya,
    "Hari sejak ditangguhkan: " + hariSejak + " hari",
    "",
    "File yang dihapus (" + filesDihapus.length + " file):",
    daftarFile || "(tidak ada file)",
    "",
    "================================================================",
    "Catatan: File dipindahkan ke Google Drive Trash.",
    "Google Drive Trash akan dibersihkan otomatis setelah 30 hari.",
    "",
    "Sistem JONG WBTb",
    "Dinas Kebudayaan Kabupaten Lingga"
  ].join("\n");

  atasanList.forEach(function(atasan) {
    try {
      GmailApp.sendEmail(
        atasan.email,
        "[JONG WBTb] Laporan Penghapusan Arsip Ditangguhkan — " + proposalId,
        isiEmail
      );
    } catch(e) {
      Logger.log("Gagal kirim laporan ke Atasan " + atasan.email + ": " + e.toString());
    }
  });
}


// ─────────────────────────────────────────────
// 7. HELPER: CATAT TANGGAL DITANGGUHKAN
//
// Dipanggil dari changeStatus() saat status
// berubah ke DITANGGUHKAN.
// Diintegrasikan ke changeStatus() di
// jong_wbtb_state_machine.js.
// ─────────────────────────────────────────────

/**
 * Mencatat tanggal penetapan status DITANGGUHKAN di kolom ditangguhkan_at.
 * Harus dipanggil bersamaan dengan changeStatus() → DITANGGUHKAN.
 *
 * @param {string} proposalId - ID usulan yang baru ditangguhkan
 */
function catatTanggalDitangguhkan(proposalId) {
  DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) return;
    sheet.getRange(hasil.rowIndex, COL.DITANGGUHKAN_AT + 1).setValue(new Date());
    sheet.getRange(hasil.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
  });
}
