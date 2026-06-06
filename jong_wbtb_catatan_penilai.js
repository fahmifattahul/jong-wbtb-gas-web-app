/**
 * JONG WBTb — Modul Workflow Catatan Penilai Eksternal
 * Sesuai Juknis Tata Kelola Dokumen Digital WBTb 2026 Revisi 2
 * Bab VI huruf D, Bab VIII huruf G
 *
 * FLOW:
 * 1. Atasan terima catatan dari Provinsi/Kementerian (di luar sistem)
 * 2. Atasan instruksikan Operator untuk entry catatan ke sistem
 * 3. Operator buka folder judul terdampak, input catatan perbaikan
 * 4. Sistem otomatis:
 *    a. Validasi format catatan (minimal ada "1.")
 *    b. Buat subfolder P[XX] di 03_REVISI
 *    c. Update revisi_round di database
 *    d. Simpan metadata Catatan Penilai
 *    e. Ubah status → DIPERBAIKI via changeStatus()
 *    f. Tulis audit log
 *
 * ATURAN KRITIS (Juknis Bab VI huruf D):
 * - Putaran Revisi HANYA bisa dibuka via fungsi ini
 * - Tidak ada Putaran Revisi tanpa Catatan Penilai Eksternal yang terdokumentasi
 * - Setiap putaran bernomor urut dan tidak dapat diulang
 *
 * CATATAN DEVELOPER:
 * - Fungsi ini adalah satu-satunya pintu masuk untuk membuka status DIPERBAIKI
 * - Jangan bypass dengan changeStatus() langsung ke DIPERBAIKI dari tempat lain
 * - Input catatan dari Operator — plain text, poin bernomor manual
 */


// ─────────────────────────────────────────────
// 1. VALIDASI FORMAT CATATAN PENILAI
// Juknis Bab VIII huruf G:
// Format poin bernomor dengan keterangan spesifik.
// ─────────────────────────────────────────────

/**
 * Memvalidasi format input catatan Penilai Eksternal.
 * Validasi ringan: tidak kosong + minimal ada "1." sebagai poin pertama.
 *
 * @param {string} catatan - Teks catatan dari Operator
 * @returns {{ valid: boolean, pesan: string }}
 */
function validateCatatanPenilai(catatan) {
  if (!catatan || typeof catatan !== "string") {
    return { valid: false, pesan: "Catatan tidak boleh kosong." };
  }

  var trimmed = catatan.trim();

  if (trimmed.length === 0) {
    return { valid: false, pesan: "Catatan tidak boleh kosong." };
  }

  if (trimmed.length < 10) {
    return {
      valid: false,
      pesan: "Catatan terlalu singkat. Isi catatan dengan poin perbaikan yang spesifik."
    };
  }

  if (trimmed.indexOf("1.") === -1) {
    return {
      valid: false,
      pesan: "Format catatan tidak sesuai Juknis Bab VIII huruf G. " +
             "Catatan harus berformat poin bernomor. Contoh:\n" +
             "1. Kajian ilmiah: Tambahkan minimal 3 narasumber primer.\n" +
             "2. Foto dokumentasi: Ganti set foto dengan kualitas tinggi."
    };
  }

  return { valid: true, pesan: "Format catatan valid." };
}


// ─────────────────────────────────────────────
// 2. FUNGSI UTAMA: ENTRY CATATAN PENILAI
//
// Satu-satunya cara membuka Putaran Revisi
// dan mengubah status ke DIPERBAIKI.
// ─────────────────────────────────────────────

/**
 * Mendokumentasikan Catatan Penilai Eksternal untuk satu Folder Usulan
 * dan membuka Putaran Revisi baru secara otomatis.
 *
 * Hanya bisa dieksekusi oleh Operator.
 * Status folder harus PERSETUJUAN_INTERNAL atau DIPERBAIKI
 * (kasus revisi lanjutan setelah putaran sebelumnya).
 *
 * @param {string} operatorEmail - Email Operator yang mengeksekusi
 * @param {string} proposalId    - ID usulan yang terdampak
 * @param {string} catatan       - Teks catatan perbaikan (format poin bernomor)
 * @param {string} sumberCatatan - Asal catatan: "Provinsi" atau "Kementerian"
 * @param {string} tanggalTerima - Tanggal Atasan terima catatan (format: "YYYY-MM-DD")
 * @returns {object}             - Hasil operasi lengkap
 */
function entryCatatanPenilai(operatorEmail, proposalId, catatan, sumberCatatan, tanggalTerima) {

  // ── Validasi aktor ────────────────────────
  requireRole(operatorEmail, ROLES.OPERATOR);

  // ── Validasi format catatan ───────────────
  var validasiCatatan = validateCatatanPenilai(catatan);
  if (!validasiCatatan.valid) {
    throw new Error(validasiCatatan.pesan);
  }

  // ── Validasi sumber catatan ───────────────
  var sumberValid = ["Provinsi", "Kementerian"];
  if (sumberValid.indexOf(sumberCatatan) === -1) {
    throw new Error(
      "Sumber catatan tidak valid. Pilih: " + sumberValid.join(" atau ") + "."
    );
  }

  // ── Validasi tanggal ──────────────────────
  if (!tanggalTerima || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalTerima)) {
    throw new Error(
      "Format tanggal tidak valid. Gunakan format YYYY-MM-DD. " +
      "Contoh: 2026-06-01"
    );
  }

  // ── Ambil data proposal ───────────────────
  var sheet  = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
  var hasil  = DatabaseEngine.findRow(sheet, COL.ID, proposalId);

  if (!hasil) {
    throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan.");
  }

  var row            = hasil.rowData;
  var statusSekarang = row[COL.STATUS];
  var revisiRound    = parseInt(row[COL.REVISI_ROUND] || "0", 10);
  var folderKaryaId  = row[COL.FOLDER_KARYA_ID];

  // ── Validasi status folder ────────────────
  // Catatan Penilai hanya bisa masuk dari PERSETUJUAN_INTERNAL atau DIPERBAIKI
  // (DIPERBAIKI = putaran revisi lanjutan setelah putaran sebelumnya selesai)
  var statusIzin = [STATUS.PERSETUJUAN_INTERNAL, STATUS.DIPERBAIKI];
  if (statusIzin.indexOf(statusSekarang) === -1) {
    throw new Error(
      "Catatan Penilai Eksternal tidak bisa dientry pada status '" + statusSekarang + "'. " +
      "Status yang diizinkan: " + statusIzin.join(" atau ") + "."
    );
  }

  // ── Hitung nomor putaran baru ─────────────
  var putaranBaru = revisiRound + 1;

  // ── Buat subfolder putaran di Drive ──────
  // createPutaranRevisiFolder() akan throw jika subfolder sudah ada
  var hasilFolder = createPutaranRevisiFolder(folderKaryaId, putaranBaru);

  // ── Simpan metadata Catatan Penilai ──────
  var catatanPenilaiArray = [];
  try {
    catatanPenilaiArray = JSON.parse(row[COL.CATATAN_PENILAI_JSON] || "[]");
  } catch(e) {
    catatanPenilaiArray = [];
  }

  var entryBaru = {
    putaran              : putaranBaru,
    sumber               : sumberCatatan,
    tanggalTerima        : tanggalTerima,
    tanggalDidokumentasi : new Date().toISOString(),
    didokumentasiOleh    : operatorEmail,
    catatan              : catatan,
    folderPutaranId      : hasilFolder.folderPutaranId,
    fileId               : null
  };

  // ── Simpan berkas catatan penilai ke subfolder CATATAN di Drive ──
  try {
    var folderPutaranObj = DriveApp.getFolderById(hasilFolder.folderPutaranId);
    var folderCatatan = getTypeFolder(folderPutaranObj, FOLDER_NAMES.JENIS.CATATAN);
    var namaFileCatatan = "CATATAN-PENILAI_" + hasilFolder.namaPutaran + ".txt";
    var isiCatatanTxt = [
      "SUMBER: " + sumberCatatan,
      "TANGGAL TERIMA: " + tanggalTerima,
      "TANGGAL DOKUMENTASI: " + entryBaru.tanggalDidokumentasi,
      "OPERATOR: " + operatorEmail,
      "------------------------------------------",
      catatan
    ].join("\n");
    var fileCatatan = folderCatatan.createFile(namaFileCatatan, isiCatatanTxt, "text/plain");
    entryBaru.fileId = fileCatatan.getId();
  } catch (errCatatan) {
    Logger.log("Warning: Gagal menyimpan berkas Catatan Penilai ke Drive: " + errCatatan.toString());
  }

  catatanPenilaiArray.push(entryBaru);

  // ── Salin berkas usulan aktif ke folder putaran revisi baru ──
  var sourceStageKey = (revisiRound > 0) ? "REVISI" : "PENGUSULAN";
  var sourcePutaranNo = (revisiRound > 0) ? revisiRound : null;
  copyActiveFilesToStage(proposalId, sourceStageKey, "REVISI", sourcePutaranNo, putaranBaru);

  // ── Update database ───────────────────────
  DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
    var hasilTx = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
    if (!hasilTx) {
      throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan saat transaksi.");
    }

    var rowIdx = hasilTx.rowIndex;

    sheetTx.getRange(rowIdx, COL.REVISI_ROUND + 1).setValue(putaranBaru);

    sheetTx.getRange(rowIdx, COL.CATATAN_PENILAI_JSON + 1)
      .setValue(JSON.stringify(catatanPenilaiArray));

    sheetTx.getRange(rowIdx, COL.UPDATED_AT + 1).setValue(new Date());
  });

  // ── Ubah status → DIPERBAIKI ──────────────
  // Lewat changeStatus() — tidak boleh bypass
  changeStatus(
    proposalId,
    STATUS.DIPERBAIKI,
    ROLES.OPERATOR,
    operatorEmail,
    null
  );

  // ── Audit log ─────────────────────────────
  writeAuditLog(
    ACTION_TYPES.CATATAN_PENILAI_UPLOAD,
    "Catatan Penilai Eksternal P" + String(putaranBaru).padStart(2, "0") +
    " terdokumentasi untuk " + proposalId + ". " +
    "Sumber: " + sumberCatatan + ". " +
    "Tanggal terima: " + tanggalTerima + ". " +
    "Folder putaran ID: " + hasilFolder.folderPutaranId + ". " +
    "Didokumentasi oleh: " + operatorEmail,
    proposalId
  );

  return {
    proposalId      : proposalId,
    putaranBaru     : putaranBaru,
    namaPutaran     : hasilFolder.namaPutaran,
    folderPutaranId : hasilFolder.folderPutaranId,
    statusBaru      : STATUS.DIPERBAIKI,
    entryBaru       : entryBaru
  };
}


// ─────────────────────────────────────────────
// 3. GET CATATAN PENILAI PER PROPOSAL
//
// Untuk ditampilkan di UI workspace Anggota Tim
// saat mereka mengerjakan revisi.
// ─────────────────────────────────────────────

/**
 * Mengambil seluruh riwayat Catatan Penilai Eksternal untuk satu proposal.
 * Bisa diakses oleh semua role.
 *
 * @param {string} requesterEmail - Email pengguna yang request
 * @param {string} proposalId     - ID usulan
 * @returns {Array}               - Array entry Catatan Penilai, urut dari P01
 */
function getCatatanPenilai(requesterEmail, proposalId) {
  requireRole(requesterEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR, ROLES.ATASAN]);

  var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
  var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);

  if (!hasil) {
    throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan.");
  }

  var raw = hasil.rowData[COL.CATATAN_PENILAI_JSON] || "[]";
  var catatanArray = [];
  try {
    catatanArray = JSON.parse(raw);
  } catch(e) {
    catatanArray = [];
  }

  catatanArray.sort(function(a, b) { return a.putaran - b.putaran; });

  return catatanArray;
}


// ─────────────────────────────────────────────
// 4. GET CATATAN PENILAI AKTIF
//
// yang paling relevan untuk Anggota Tim saat
// sedang mengerjakan revisi.
// ─────────────────────────────────────────────

/**
 * Mengambil Catatan Penilai Eksternal untuk putaran revisi yang sedang aktif.
 *
 * @param {string} requesterEmail - Email pengguna yang request
 * @param {string} proposalId     - ID usulan
 * @returns {object|null}         - Entry catatan putaran aktif, atau null jika belum ada
 */
function getCatatanPenilaiAktif(requesterEmail, proposalId) {
  var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
  var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);

  if (!hasil) {
    throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan.");
  }

  var row          = hasil.rowData;
  var revisiRound  = parseInt(row[COL.REVISI_ROUND] || "0", 10);

  if (revisiRound === 0) return null;

  var semuaCatatan = getCatatanPenilai(requesterEmail, proposalId);
  var aktif = semuaCatatan.find(function(c) { return c.putaran === revisiRound; });

  return aktif || null;
}
