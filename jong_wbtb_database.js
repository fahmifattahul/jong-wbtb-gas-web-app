/**
 * JONG WBTb — Database Schema & Initialization
 * Google Sheets sebagai DBMS layer
 *
 * Dua tabel:
 * 1. db_wbtb_lingga   — data aktif setiap Folder Usulan
 * 2. db_activity_log  — audit trail seluruh aktivitas sistem
 *
 * CATATAN DEVELOPER:
 * - Selalu gunakan konstanta COL_* untuk index kolom.
 *   Jangan hardcode angka index kolom di tempat lain.
 * - Kolom index di sini adalah 0-based (untuk array JS).
 *   Konversi ke 1-based saat pakai sheet.getRange(row, col+1).
 * - Jangan pernah hapus kolom — tambah saja di akhir jika butuh kolom baru.
 *   Penghapusan kolom akan menggeser semua index dan merusak seluruh sistem.
 */


// ─────────────────────────────────────────────
// 1. KONSTANTA NAMA SPREADSHEET & SHEET
// ─────────────────────────────────────────────

var DB_NAMES = {
  SPREADSHEET: "db_jong_wbtb",
  WBTB_LINGGA: "db_wbtb_lingga",
  ACTIVITY_LOG: "db_activity_log"
};


// ─────────────────────────────────────────────
// 2. DOMAIN WBTb NASIONAL
// Sumber: Permendikbud No. 106 Tahun 2013
// Juknis Bab II huruf A nomor 1
// ─────────────────────────────────────────────

var DOMAIN_WBTB = [
  "Tradisi dan Ekspresi Lisan",
  "Seni Pertunjukan",
  "Adat Istiadat Masyarakat, Ritus, dan Perayaan-Perayaan",
  "Pengetahuan dan Kebiasaan Perilaku Mengenai Alam dan Semesta",
  "Kemahiran Kerajinan Tradisional",
  "Olahraga Tradisional dan Permainan Rakyat",
  "Kuliner Tradisional",
  "Arsitektur Tradisional",
  "Moda Transportasi Tradisional",
  "Tekstil Tradisional"
];


// ─────────────────────────────────────────────
// 3. SCHEMA: db_wbtb_lingga
//
// Satu baris = satu Folder Usulan karya budaya.
// Kolom index 0-based.
// ─────────────────────────────────────────────

var COL = {

  // ── Identitas ──────────────────────────────
  ID: 0,   // String  | PK | Format: "WBTB-001". Sequential, tidak dibedakan normal/historis.
  NAMA_KARYA: 1,   // String  |    | Nama karya budaya takbenda.
  DOMAIN: 2,   // String  |    | Salah satu dari DOMAIN_WBTB (10 domain nasional Permendikbud).
  TAHUN_USULAN: 3,   // Integer |    | Tahun pembuatan draf / tahun penetapan (untuk historis).
  ENTRY_TYPE: 4,   // String  |    | "normal" atau "historis" (dari ENTRY_TYPE).

  // ── Status & Revisi ────────────────────────
  STATUS: 5,   // String  |    | Status aktif folder (dari konstanta STATUS). Juknis Bab VIII D.
  REVISI_ROUND: 6,   // Integer |    | Nomor putaran revisi aktif (0 = belum pernah revisi).
  //              | Putaran hanya naik saat Catatan Penilai Eksternal masuk.
  //              | Juknis Bab VI D & Bab II A nomor 11.

  // ── Penanggung Jawab ───────────────────────
  // Juknis Bab VII huruf B: satu Folder Usulan hanya boleh dikerjakan
  // oleh satu Anggota Tim yang ditetapkan Atasan.
  PENANGGUNG_JAWAB_EMAIL: 7,  // String | Email Anggota Tim penanggung jawab folder ini.
  PENANGGUNG_JAWAB_NAMA: 8,  // String | Nama Anggota Tim penanggung jawab (untuk display).

  // ── Catatan ───────────────────────────────
  // Juknis Bab VIII huruf G: catatan format poin bernomor dari Atasan.
  // Ini catatan internal Atasan — BUKAN Catatan Penilai Eksternal.
  // Catatan Penilai Eksternal disimpan sebagai file di subfolder CATATAN/PXX/.
  CATATAN_ATASAN: 9,   // String  |    | Catatan perbaikan internal dari Atasan (Kabid NATBK).

  // ── Google Drive References ────────────────
  FOLDER_KARYA_ID: 10,  // String  |    | Google Drive Folder ID folder karya budaya utama.
  FOLDER_IDS_JSON: 11,  // String (JSON) | Map ID semua subfolder tahap.
  //              | Format: { "PENGUMPULAN_DATA": "id", "PENGUSULAN": "id", ... }

  // ── Dokumen Aktif ─────────────────────────
  // Referensi ke Google Docs formulir usulan yang sedang aktif disunting.
  DOC_ACTIVE_ID: 12,  // String  |    | Google Docs ID formulir versi aktif.
  DOC_HISTORY_JSON: 13,  // String (JSON) | Riwayat versi formulir.
  //              | Format: { "v1": "docId", "v2": "docId", ... }

  // ── File Pendukung ─────────────────────────
  // Array JSON metadata file yang sudah diunggah ke Drive.
  // Format setiap item: { fileId, name, size, uploadedAt, uploadedBy }
  KAJIAN_FILES_JSON: 14,  // String (JSON) | File kajian ilmiah (PDF).
  FOTO_FILES_JSON: 15,  // String (JSON) | File foto dokumentasi (JPG/PNG).
  VIDEO_URL: 16,  // String        | URL video eksternal (YouTube/Drive Publik).
  //               | Juknis Bab IV C: video tidak diunggah langsung.
  SERTIFIKAT_FILES_JSON: 17,  // String (JSON) | File sertifikat/SK penetapan (PDF). Wajib untuk historis.

  // ── Catatan Penilai Eksternal ──────────────
  // Juknis Bab VI huruf D: Putaran Revisi hanya bisa dibuka setelah
  // Catatan Penilai Eksternal diterima dan terdokumentasi Operator.
  // File Catatan Penilai disimpan di Drive (subfolder CATATAN/PXX/).
  // Di sini hanya metadata untuk tracking.
  CATATAN_PENILAI_JSON: 18,  // String (JSON) | Array metadata Catatan Penilai Eksternal.
  //               | Format: [{ putaran, fileId, diterimaTanggal, didokumentasiOleh }]

  // ── Flags ─────────────────────────────────
  DRIVE_LOCKED: 19,  // Boolean |   | TRUE jika folder dikunci (status Final/Ditangguhkan).
  //             | Juknis Bab IV B & Bab VIII D.

  // ── Timestamps ────────────────────────────
  CREATED_AT: 20,  // Date    |   | Tanggal folder dibuat / diimport.
  UPDATED_AT: 21,   // Date    |   | Tanggal terakhir ada perubahan data.

  // ── Judul Singkat ────────────────────────────
  JUDUL_SINGKAT: 22,  // String | Input user saat buat usulan. UPPERCASE, hanya A-Z dan tanda hubung.

  // ── Penangguhan Reminder ────────────────────────────
  DITANGGUHKAN_AT: 23, // Date

  // ── Verifikasi Atasan ───────────────────────────────
  IS_APPROVED_BY_ATASAN: 24 // Boolean (TRUE jika sudah di-ACC Atasan)
};

// Total kolom: 25
var TOTAL_COLS_WBTB = 25;


// ─────────────────────────────────────────────
// 4. SCHEMA: db_activity_log
//
// Satu baris = satu aksi yang terjadi di sistem.
// Append-only — tidak boleh diedit atau dihapus.
// ─────────────────────────────────────────────

var COL_LOG = {
  TIMESTAMP: 0,  // Date   | Waktu aksi terjadi.
  USER_EMAIL: 1,  // String | Email pengguna yang mengeksekusi aksi.
  USER_ROLE: 2,  // String | Peran saat aksi (dari ROLES).
  PROPOSAL_ID: 3,  // String | ID usulan yang terdampak (null jika aksi sistem).
  ACTION_TYPE: 4,  // String | Kode aksi (lihat ACTION_TYPES di bawah).
  DETAIL: 5   // String | Narasi lengkap aksi untuk keperluan audit.
};

var TOTAL_COLS_LOG = 6;


// Kode aksi standar untuk kolom ACTION_TYPE
var ACTION_TYPES = {
  // Workspace
  WORKSPACE_INIT_START: "WORKSPACE_INIT_START",
  WORKSPACE_INIT_SUCCESS: "WORKSPACE_INIT_SUCCESS",
  HISTORIS_INIT_START: "HISTORIS_INIT_START",
  HISTORIS_INIT_SUCCESS: "HISTORIS_INIT_SUCCESS",

  // Status
  STATUS_CHANGE: "STATUS_CHANGE",

  // Putaran Revisi
  PUTARAN_REVISI_CREATED: "PUTARAN_REVISI_CREATED",
  CATATAN_PENILAI_UPLOAD: "CATATAN_PENILAI_UPLOAD",

  // Dokumen
  FORMULIR_VERSI_BARU: "FORMULIR_VERSI_BARU",
  KAJIAN_UPLOAD: "KAJIAN_UPLOAD",
  FOTO_UPLOAD: "FOTO_UPLOAD",
  VIDEO_URL_SET: "VIDEO_URL_SET",
  SERTIFIKAT_UPLOAD: "SERTIFIKAT_UPLOAD",
  ARSIP_VERSI_PINDAH: "ARSIP_VERSI_PINDAH",  // file lama dipindah ke ARSIP-VERSI sebelum ditimpa

  // Akses
  DRIVE_ACCESS_FROZEN: "DRIVE_ACCESS_FROZEN",
  DRIVE_ACCESS_UNFROZEN: "DRIVE_ACCESS_UNFROZEN",
  AKSES_DITAMBAH: "AKSES_DITAMBAH",
  AKSES_DICABUT: "AKSES_DICABUT",

  // Catatan Atasan
  CATATAN_ATASAN_SET: "CATATAN_ATASAN_SET",

  // Error
  ERROR: "ERROR"
};


// ─────────────────────────────────────────────
// 5. HEADER ROWS
// Dipakai saat inisialisasi sheet baru.
// Urutan harus 1:1 dengan konstanta COL di atas.
// ─────────────────────────────────────────────

var HEADERS_WBTB = [
  "id",
  "nama_karya",
  "domain",
  "tahun_usulan",
  "entry_type",
  "status",
  "revisi_round",
  "penanggung_jawab_email",
  "penanggung_jawab_nama",
  "catatan_atasan",
  "folder_karya_id",
  "folder_ids_json",
  "doc_active_id",
  "doc_history_json",
  "kajian_files_json",
  "foto_files_json",
  "video_url",
  "sertifikat_files_json",
  "catatan_penilai_json",
  "drive_locked",
  "created_at",
  "updated_at",
  "judul_singkat",
  "ditangguhkan_at",
  "is_approved_by_atasan"
];

var HEADERS_LOG = [
  "timestamp",
  "user_email",
  "user_role",
  "proposal_id",
  "action_type",
  "detail"
];


// ─────────────────────────────────────────────
// 6. DATABASE ENGINE
//
// Concurrency control via LockService.
// Semua operasi tulis ke sheet harus lewat
// executeTransaction() — tidak boleh bypass.
// ─────────────────────────────────────────────

var DatabaseEngine = {

  /**
   * Mengambil spreadsheet aktif.
   * @returns {Spreadsheet}
   */
  getSpreadsheet: function () {
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  /**
   * Mengambil sheet berdasarkan nama.
   * Throw error jika tidak ditemukan — jangan return null diam-diam.
   *
   * @param {string} sheetName
   * @returns {Sheet}
   */
  getSheet: function (sheetName) {
    var sheet = this.getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(
        "Sheet '" + sheetName + "' tidak ditemukan. " +
        "Pastikan spreadsheet sudah diinisialisasi via initializeDatabase()."
      );
    }
    return sheet;
  },

  /**
   * Menjalankan operasi tulis dengan proteksi konkurensi (thread-safe).
   * Semua operasi tulis ke sheet WAJIB lewat fungsi ini.
   *
   * @param {string}   sheetName           - Nama sheet target
   * @param {function} transactionCallback - Fungsi yang menerima sheet dan menjalankan operasi
   * @returns {*} Nilai kembalian dari transactionCallback
   */
  executeTransaction: function (sheetName, transactionCallback) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      var sheet = this.getSheet(sheetName);
      var result = transactionCallback(sheet);
      SpreadsheetApp.flush();
      return result;
    } catch (e) {
      writeAuditLog("ERROR", "Transaction error di sheet '" + sheetName + "': " + e.toString());
      throw new Error("Transaksi gagal: " + e.message);
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Mencari baris berdasarkan nilai di kolom tertentu.
   * Return object { rowIndex (1-based), rowData } atau null jika tidak ditemukan.
   *
   * @param {Sheet}  sheet      - Sheet target
   * @param {number} colIndex   - Index kolom pencarian (0-based)
   * @param {string} value      - Nilai yang dicari
   * @returns {{ rowIndex: number, rowData: Array }|null}
   */
  findRow: function (sheet, colIndex, value) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) { // skip header row (i=0)
      if (String(data[i][colIndex]) === String(value)) {
        return { rowIndex: i + 1, rowData: data[i] }; // rowIndex 1-based
      }
    }
    return null;
  }
};


// ─────────────────────────────────────────────
// 7. AUDIT LOG WRITER
// ─────────────────────────────────────────────

/**
 * Menulis satu baris audit trail ke db_activity_log.
 * Append-only — tidak pernah mengedit baris yang sudah ada.
 *
 * @param {string} actionType  - Kode aksi (dari ACTION_TYPES)
 * @param {string} detail      - Narasi lengkap aksi
 * @param {string} proposalId  - ID usulan terdampak (opsional, "" jika aksi sistem)
 */
function writeAuditLog(actionType, detail, proposalId) {
  try {
    var userEmail = Session.getActiveUser().getEmail() || "system@jong-wbtb";
    var userRole = getUserRole(userEmail); // lihat fungsi RBAC

    DatabaseEngine.executeTransaction(DB_NAMES.ACTIVITY_LOG, function (sheet) {
      sheet.appendRow([
        new Date(),
        userEmail,
        userRole,
        proposalId || "",
        actionType,
        detail
      ]);
    });
  } catch (e) {
    // Log error tidak boleh throw — jangan sampai audit log failure
    // menggagalkan operasi utama yang sedang berjalan.
    Logger.log("AUDIT LOG FAILED: " + e.toString());
  }
}


// ─────────────────────────────────────────────
// 8. INISIALISASI DATABASE
//
// Dipanggil SEKALI saat setup awal sistem.
// Membuat kedua sheet dengan header yang benar.
// ─────────────────────────────────────────────

/**
 * Menginisialisasi spreadsheet database JONG WBTb.
 * Membuat sheet db_wbtb_lingga dan db_activity_log jika belum ada.
 * Jika sheet sudah ada, fungsi ini tidak melakukan apa-apa (idempotent).
 *
 * Jalankan fungsi ini SATU KALI dari GAS editor saat setup awal.
 */
function initializeDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Inisialisasi db_wbtb_lingga
  var sheetWbtb = ss.getSheetByName(DB_NAMES.WBTB_LINGGA);
  if (!sheetWbtb) {
    sheetWbtb = ss.insertSheet(DB_NAMES.WBTB_LINGGA);
    sheetWbtb.appendRow(HEADERS_WBTB);
    sheetWbtb.setFrozenRows(1);
    // Format header row
    sheetWbtb.getRange(1, 1, 1, TOTAL_COLS_WBTB)
      .setFontWeight("bold")
      .setBackground("#E8F0FE");
    Logger.log("Sheet '" + DB_NAMES.WBTB_LINGGA + "' berhasil dibuat.");
  } else {
    Logger.log("Sheet '" + DB_NAMES.WBTB_LINGGA + "' sudah ada — dilewati.");
    // Auto-migrasi: Tambah kolom is_approved_by_atasan ke sheet jika belum ada
    var cellHeader = sheetWbtb.getRange(1, TOTAL_COLS_WBTB);
    if (cellHeader.getValue() !== HEADERS_WBTB[TOTAL_COLS_WBTB - 1]) {
      cellHeader.setValue(HEADERS_WBTB[TOTAL_COLS_WBTB - 1]);
      sheetWbtb.getRange(1, 1, 1, TOTAL_COLS_WBTB)
        .setFontWeight("bold")
        .setBackground("#E8F0FE");
      Logger.log("Kolom 'is_approved_by_atasan' berhasil ditambahkan ke sheet lama.");
    }
  }

  // Inisialisasi db_activity_log
  var sheetLog = ss.getSheetByName(DB_NAMES.ACTIVITY_LOG);
  if (!sheetLog) {
    sheetLog = ss.insertSheet(DB_NAMES.ACTIVITY_LOG);
    sheetLog.appendRow(HEADERS_LOG);
    sheetLog.setFrozenRows(1);
    sheetLog.getRange(1, 1, 1, TOTAL_COLS_LOG)
      .setFontWeight("bold")
      .setBackground("#FCE8E6");
    Logger.log("Sheet '" + DB_NAMES.ACTIVITY_LOG + "' berhasil dibuat.");
  } else {
    Logger.log("Sheet '" + DB_NAMES.ACTIVITY_LOG + "' sudah ada — dilewati.");
  }

  Logger.log("Inisialisasi database selesai.");
}


// ─────────────────────────────────────────────
// 9. GENERATOR ID PROPOSAL
//
// Format: WBTB-{NNN} — 3 digit, zero-padded.
// Sequential, tidak dibedakan normal/historis.
// Jika row count >= 1000, otomatis naik ke 4 digit.
// ─────────────────────────────────────────────

/**
 * Men-generate ID proposal baru yang unik.
 * Harus dipanggil di dalam executeTransaction untuk menghindari race condition.
 *
 * @param {Sheet} sheet - Sheet db_wbtb_lingga (sudah di dalam transaksi)
 * @returns {string}    - ID baru (contoh: "WBTB-001")
 */
function generateProposalId(sheet) {
  var lastRow = sheet.getLastRow();
  var nextNum = lastRow; // row 1 = header, row 2 = data pertama → ID ke-1
  var padLen = nextNum >= 1000 ? 4 : 3;
  return "WBTB-" + String(nextNum).padStart(padLen, "0");
}
