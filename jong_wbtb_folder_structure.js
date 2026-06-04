/**
 * JONG WBTb — Folder Structure & Workspace Initialization
 * Sesuai Juknis Tata Kelola Dokumen Digital WBTb 2026 Revisi 2
 * Bab III huruf B & C
 *
 * CATATAN DEVELOPER:
 * - Seluruh nama folder menggunakan konstanta FOLDER_NAMES di bawah.
 *   Jangan hardcode string nama folder di tempat lain.
 * - Subfolder tahap bersifat PERMANEN — tidak boleh dipindah atau dihapus.
 *   Perpindahan tahap hanya dicatat secara administratif di database.
 * - Subfolder Putaran Revisi (P01, P02, ...) dibuat dinamis oleh
 *   fungsi createPutaranRevisiFolder() saat Catatan Penilai Eksternal masuk.
 */


// ─────────────────────────────────────────────
// 1. KONSTANTA NAMA FOLDER
// Juknis Bab III huruf B & C:
// UPPERCASE, spasi dilarang, `-` pemisah kata, `_` pemisah segmen
// ─────────────────────────────────────────────

var FOLDER_NAMES = {

  // Folder root terpusat — satu per tahun periode pengusulan
  ROOT: "WBTB_LINGGA_2026",

  // 6 subfolder tahap permanen per Folder Usulan
  // Juknis Bab III huruf B
  TAHAP: {
    PENGUMPULAN_DATA    : "01_PENGUMPULAN-DATA",
    PENGUSULAN          : "02_PENGUSULAN",
    REVISI              : "03_REVISI",
    PENETAPAN           : "04_PENETAPAN",
    ARSIP_DITANGGUHKAN  : "05_ARSIP-DITANGGUHKAN",
    FINAL               : "06_FINAL"
  },

  // Subfolder jenis dokumen di dalam setiap subfolder tahap
  // Juknis Bab III huruf B paragraf 3
  JENIS: {
    FORMULIR_USULAN     : "FORMULIR-USULAN",
    KAJIAN_ILMIAH       : "KAJIAN-ILMIAH",
    FOTO_DOKUMENTASI    : "FOTO-DOKUMENTASI",
    VIDEO_DOKUMENTASI   : "VIDEO-DOKUMENTASI",  // berisi file .txt tautan eksternal
    CATATAN             : "CATATAN",
    ARSIP_VERSI         : "ARSIP-VERSI"          // tempat versi lama sebelum ditimpa
  },

  // Subfolder khusus Arsip Historis — terpisah dari pengusulan aktif
  // Juknis Bab IX huruf B
  ARSIP_HISTORIS: "ARSIP-HISTORIS"
};

var TEMPLATE_FORMULIR_ID = "1oZnDVYQH1btwwxirzAwBs6Wepyuy9Cj0O9fhJBaQUF0";

// ─────────────────────────────────────────────
// 2. HELPER: FORMAT NAMA FOLDER KARYA
//
// Format: WBTB-{ID}_{NAMA-KARYA-UPPERCASE}
// Contoh: WBTB-001_TEPUNG-TAWAR-LINGGA
// ─────────────────────────────────────────────

/**
 * Memformat nama folder karya budaya sesuai konvensi Juknis.
 *
 * @param {string} proposalId  - ID usulan (contoh: "WBTB-001")
 * @param {string} namaKarya   - Nama karya budaya (contoh: "Tepung Tawar Lingga")
 * @returns {string}           - Nama folder terformat (contoh: "WBTB-001_TEPUNG-TAWAR-LINGGA")
 */
function formatNamaFolderKarya(proposalId, namaKarya) {
  var namaFormatted = namaKarya
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s]/g, "")   // hapus karakter non-alfanumerik kecuali spasi
    .replace(/\s+/g, "-");          // spasi → tanda hubung
  return proposalId + "_" + namaFormatted;
}


/**
 * Memformat nama subfolder Putaran Revisi.
 * Contoh: putaran 1 → "P01", putaran 2 → "P02"
 *
 * @param {number} nomorPutaran - Nomor putaran revisi (integer >= 1)
 * @returns {string}            - Nama subfolder putaran (contoh: "P01")
 */
function formatNamaPutaran(nomorPutaran) {
  return "P" + String(nomorPutaran).padStart(2, "0");
}


// ─────────────────────────────────────────────
// 3. HELPER: GET OR CREATE FOLDER
//
// Utility untuk menghindari duplikasi folder
// jika fungsi dipanggil ulang karena error.
// ─────────────────────────────────────────────

/**
 * Mengambil folder berdasarkan nama di dalam parent folder.
 * Jika belum ada, membuat folder baru.
 *
 * @param {Folder} parentFolder - Google Drive Folder object
 * @param {string} namaFolder   - Nama folder yang dicari/dibuat
 * @returns {Folder}            - Google Drive Folder object
 */
function getOrCreateFolder(parentFolder, namaFolder) {
  var iter = parentFolder.getFoldersByName(namaFolder);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(namaFolder);
}


// ─────────────────────────────────────────────
// 4. INISIALISASI FOLDER ROOT
// ─────────────────────────────────────────────

/**
 * Mengambil atau membuat folder root terpusat WBTB_LINGGA_2026.
 * Juknis Bab III huruf B: satu folder utama per tahun periode pengusulan.
 *
 * @returns {Folder} - Google Drive Folder object untuk root
 */
function getRootFolder() {
  var iter = DriveApp.getFoldersByName(FOLDER_NAMES.ROOT);
  if (iter.hasNext()) {
    return iter.next();
  }
  return DriveApp.createFolder(FOLDER_NAMES.ROOT);
}


// ─────────────────────────────────────────────
// 5. INISIALISASI WORKSPACE USULAN BARU
//
// Dipanggil saat Operator membuat folder usulan baru.
// Menghasilkan seluruh struktur direktori sesuai Juknis Bab III huruf B.
// ─────────────────────────────────────────────

/**
 * Membangun struktur folder lengkap untuk satu Folder Usulan baru.
 *
 * Struktur yang dihasilkan:
 * /WBTB_LINGGA_2026/
 * └── WBTB-001_TEPUNG-TAWAR-LINGGA/
 *     ├── 01_PENGUMPULAN-DATA/
 *     │   ├── FORMULIR-USULAN/
 *     │   │   └── ARSIP-VERSI/
 *     │   ├── KAJIAN-ILMIAH/
 *     │   │   └── ARSIP-VERSI/
 *     │   ├── FOTO-DOKUMENTASI/
 *     │   │   └── ARSIP-VERSI/
 *     │   ├── VIDEO-DOKUMENTASI/
 *     │   └── CATATAN/
 *     ├── 02_PENGUSULAN/
 *     │   └── [struktur jenis dokumen sama]
 *     ├── 03_REVISI/
 *     │   └── [subfolder P01, P02, ... dibuat dinamis saat revisi dimulai]
 *     ├── 04_PENETAPAN/
 *     │   └── [struktur jenis dokumen sama]
 *     ├── 05_ARSIP-DITANGGUHKAN/
 *     └── 06_FINAL/
 *         └── [struktur jenis dokumen sama]
 *
 * @param {string} proposalId  - ID unik usulan (contoh: "WBTB-001")
 * @param {string} namaKarya   - Nama karya budaya
 * @returns {object}           - Metadata folder yang dibuat
 */
function initProposalWorkspace(proposalId, namaKarya) {

  writeAuditLog("WORKSPACE_INIT_START",
    "Mulai inisialisasi workspace untuk " + proposalId + " - " + namaKarya);

  // 1. Root folder
  var rootFolder = getRootFolder();

  // 2. Folder karya budaya
  var namaFolderKarya = formatNamaFolderKarya(proposalId, namaKarya);
  var folderKarya     = getOrCreateFolder(rootFolder, namaFolderKarya);
  var folderKaryaId   = folderKarya.getId();

  // 3. Buat 6 subfolder tahap permanen
  // Juknis Bab III huruf B: subfolder tahap tidak dipindahkan secara fisik;
  // perpindahan tahap hanya dicatat secara administratif.
  var folderIds = {};

  var tahapList = [
    { key: "PENGUMPULAN_DATA",   nama: FOLDER_NAMES.TAHAP.PENGUMPULAN_DATA,   buatJenis: true  },
    { key: "PENGUSULAN",         nama: FOLDER_NAMES.TAHAP.PENGUSULAN,          buatJenis: true  },
    { key: "REVISI",             nama: FOLDER_NAMES.TAHAP.REVISI,              buatJenis: false }, // subfolder Putaran dibuat dinamis
    { key: "PENETAPAN",          nama: FOLDER_NAMES.TAHAP.PENETAPAN,           buatJenis: true  },
    { key: "ARSIP_DITANGGUHKAN", nama: FOLDER_NAMES.TAHAP.ARSIP_DITANGGUHKAN, buatJenis: false }, // isi disalin manual saat penangguhan
    { key: "FINAL",              nama: FOLDER_NAMES.TAHAP.FINAL,               buatJenis: true  }
  ];

  tahapList.forEach(function(tahap) {
    var folderTahap = getOrCreateFolder(folderKarya, tahap.nama);
    folderIds[tahap.key] = folderTahap.getId();

    // 4. Buat subfolder jenis dokumen di dalam tahap yang relevan
    // Juknis Bab III huruf B paragraf 3
    if (tahap.buatJenis) {
      buatSubfolderJenis(folderTahap);
    }
  });

  writeAuditLog("WORKSPACE_INIT_SUCCESS",
    "Workspace berhasil dibuat untuk " + proposalId +
    ". Folder karya ID: " + folderKaryaId);

  return {
    proposalId      : proposalId,
    namaKarya       : namaKarya,
    namaFolderKarya : namaFolderKarya,
    folderKaryaId   : folderKaryaId,
    folderIds       : folderIds
  };
}


/**
 * Membuat subfolder jenis dokumen di dalam satu subfolder tahap.
 * Setiap jenis dokumen memiliki subfolder ARSIP-VERSI untuk menyimpan versi lama.
 * Juknis Bab VI huruf C: dilarang menimpa versi lama — wajib dipindah ke arsip versi.
 *
 * @param {Folder} folderTahap - Google Drive Folder object subfolder tahap
 */
function buatSubfolderJenis(folderTahap) {
  var jenisYangButuhArsipVersi = [
    FOLDER_NAMES.JENIS.FORMULIR_USULAN,
    FOLDER_NAMES.JENIS.KAJIAN_ILMIAH,
    FOLDER_NAMES.JENIS.FOTO_DOKUMENTASI,
    FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI  // Dipindah ke sini agar subfolder ARSIP-VERSI dibuat
  ];

  var jenisTanpaArsipVersi = [
    FOLDER_NAMES.JENIS.CATATAN
  ];

  jenisYangButuhArsipVersi.forEach(function(namaJenis) {
    var folderJenis = getOrCreateFolder(folderTahap, namaJenis);
    getOrCreateFolder(folderJenis, FOLDER_NAMES.JENIS.ARSIP_VERSI);
  });

  jenisTanpaArsipVersi.forEach(function(namaJenis) {
    getOrCreateFolder(folderTahap, namaJenis);
  });
}


// ─────────────────────────────────────────────
// 6. BUAT SUBFOLDER PUTARAN REVISI
//
// Dipanggil HANYA saat Catatan Penilai Eksternal
// diterima dan terdokumentasi (status → DIPERBAIKI).
// Juknis Bab VI huruf D & Bab III huruf B.
// ─────────────────────────────────────────────

/**
 * Membuat subfolder Putaran Revisi baru di dalam 03_REVISI.
 * Hanya boleh dipanggil setelah Catatan Penilai Eksternal terdokumentasi.
 *
 * Struktur yang dihasilkan:
 * /03_REVISI/
 * └── P01/
 *     ├── FORMULIR-USULAN/
 *     │   └── ARSIP-VERSI/
 *     ├── KAJIAN-ILMIAH/
 *     │   └── ARSIP-VERSI/
 *     ├── FOTO-DOKUMENTASI/
 *     │   └── ARSIP-VERSI/
 *     ├── VIDEO-DOKUMENTASI/
 *     └── CATATAN/
 *         └── [file CATATAN-PENILAI_P01 disimpan di sini]
 *
 * @param {string} folderKaryaId  - Google Drive ID folder karya budaya
 * @param {number} nomorPutaran   - Nomor putaran revisi (integer >= 1)
 * @returns {object}              - Metadata subfolder putaran yang dibuat
 */
function createPutaranRevisiFolder(folderKaryaId, nomorPutaran) {

  var namaPutaran = formatNamaPutaran(nomorPutaran);

  var folderKarya  = DriveApp.getFolderById(folderKaryaId);
  var iterRevisi   = folderKarya.getFoldersByName(FOLDER_NAMES.TAHAP.REVISI);

  if (!iterRevisi.hasNext()) {
    throw new Error(
      "Subfolder " + FOLDER_NAMES.TAHAP.REVISI +
      " tidak ditemukan di folder karya ID: " + folderKaryaId
    );
  }

  var folderRevisi  = iterRevisi.next();

  // Cek apakah putaran ini sudah pernah dibuat (idempotent)
  var iterPutaran = folderRevisi.getFoldersByName(namaPutaran);
  if (iterPutaran.hasNext()) {
    throw new Error(
      "Subfolder putaran " + namaPutaran + " sudah ada. " +
      "Setiap putaran hanya boleh dibuat satu kali. " +
      "Juknis Bab VI huruf D: putaran tidak dapat diulang."
    );
  }

  var folderPutaran = folderRevisi.createFolder(namaPutaran);

  // Buat subfolder jenis dokumen di dalam putaran
  // Juknis Bab VI huruf D: putaran hanya memuat dokumen yang benar-benar
  // direvisi. Anggota Tim yang menentukan file mana yang dimasukkan.
  buatSubfolderJenis(folderPutaran);

  writeAuditLog(
    "PUTARAN_REVISI_CREATED",
    "Subfolder putaran " + namaPutaran + " berhasil dibuat di folder ID: " + folderKaryaId +
    ". Catatan Penilai Eksternal wajib disimpan di " + namaPutaran +
    "/" + FOLDER_NAMES.JENIS.CATATAN + "."
  );

  return {
    folderKaryaId  : folderKaryaId,
    nomorPutaran   : nomorPutaran,
    namaPutaran    : namaPutaran,
    folderPutaranId: folderPutaran.getId()
  };
}


// ─────────────────────────────────────────────
// 7. INISIALISASI WORKSPACE ARSIP HISTORIS
//
// Entry point khusus untuk dokumen WBTb yang
// sudah ditetapkan sebelum Juknis ini berlaku.
// Juknis Bab IX huruf B.
// ─────────────────────────────────────────────

/**
 * Membuat struktur folder untuk import arsip historis.
 * Langsung di bawah folder ARSIP-HISTORIS, bukan di bawah folder tahun aktif.
 * Status langsung FINAL — skip seluruh tahap pengusulan.
 *
 * Syarat wajib: sertifikat penetapan tersedia.
 * Opsional: formulir, kajian, multimedia (sering hilang di dokumen lama).
 *
 * Struktur yang dihasilkan:
 * /WBTB_LINGGA_2026/
 * └── ARSIP-HISTORIS/
 *     └── WBTB-H001_TEPUNG-TAWAR-LINGGA/
 *         ├── FORMULIR-USULAN/     (opsional)
 *         ├── KAJIAN-ILMIAH/       (opsional)
 *         ├── FOTO-DOKUMENTASI/    (opsional)
 *         ├── VIDEO-DOKUMENTASI/   (opsional)
 *         └── SERTIFIKAT/          (WAJIB)
 *
 * @param {string} proposalId  - ID usulan historis (contoh: "WBTB-H001")
 * @param {string} namaKarya   - Nama karya budaya
 * @returns {object}           - Metadata folder yang dibuat
 */
function initHistorisWorkspace(proposalId, namaKarya) {

  writeAuditLog("HISTORIS_INIT_START",
    "Mulai inisialisasi arsip historis untuk " + proposalId + " - " + namaKarya);

  var rootFolder    = getRootFolder();
  var folderArsip   = getOrCreateFolder(rootFolder, FOLDER_NAMES.ARSIP_HISTORIS);

  var namaFolderKarya = formatNamaFolderKarya(proposalId, namaKarya);
  var folderKarya     = getOrCreateFolder(folderArsip, namaFolderKarya);
  var folderKaryaId   = folderKarya.getId();

  // Buat subfolder jenis — semua opsional kecuali SERTIFIKAT
  getOrCreateFolder(folderKarya, FOLDER_NAMES.JENIS.FORMULIR_USULAN);
  getOrCreateFolder(folderKarya, FOLDER_NAMES.JENIS.KAJIAN_ILMIAH);
  getOrCreateFolder(folderKarya, FOLDER_NAMES.JENIS.FOTO_DOKUMENTASI);
  getOrCreateFolder(folderKarya, FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
  getOrCreateFolder(folderKarya, "SERTIFIKAT"); // wajib — syarat import historis

  writeAuditLog("HISTORIS_INIT_SUCCESS",
    "Workspace arsip historis berhasil dibuat untuk " + proposalId +
    ". Folder ID: " + folderKaryaId +
    ". Catatan: folder ini bersifat hanya-baca setelah sertifikat diisi. " +
    "Juknis Bab IX huruf B.");

  return {
    proposalId      : proposalId,
    namaKarya       : namaKarya,
    namaFolderKarya : namaFolderKarya,
    folderKaryaId   : folderKaryaId,
    entryType       : "historis"
  };
}


// ─────────────────────────────────────────────
// 8. HELPER & CORE WORKFLOW PENYALINAN BERKAS
// Juknis Bab III huruf B & Bab VIII huruf D
// ─────────────────────────────────────────────

/**
 * Mendapatkan Key subfolder tahap yang aktif berdasarkan status dan persetujuan.
 *
 * @param {string} status             - Status proposal saat ini
 * @param {number} revisiRound        - Putaran revisi aktif (0 = belum revisi)
 * @param {boolean} isApprovedByAtasan - TRUE jika sudah disetujui Atasan secara internal
 * @returns {string}                  - Key tahap (PENGUMPULAN_DATA, PENGUSULAN, REVISI, dst.)
 */
function getActiveStageKey(status, revisiRound, isApprovedByAtasan) {
  if (status === STATUS.SEDANG_DIKERJAKAN) {
    return revisiRound > 0 ? "REVISI" : "PENGUMPULAN_DATA";
  }
  if (status === STATUS.DIPERBAIKI) {
    return "REVISI";
  }
  if (status === STATUS.PERSETUJUAN_INTERNAL) {
    return isApprovedByAtasan ? "PENGUSULAN" : (revisiRound > 0 ? "REVISI" : "PENGUMPULAN_DATA");
  }
  if (status === STATUS.DILANJUTKAN) {
    return "PENETAPAN";
  }
  if (status === STATUS.DITANGGUHKAN) {
    return "ARSIP_DITANGGUHKAN";
  }
  if (status === STATUS.FINAL) {
    return "FINAL";
  }
  throw new Error("Status '" + status + "' tidak dikenal.");
}

/**
 * Mengambil Folder objek Google Drive untuk tahap tertentu.
 *
 * @param {Array} row           - Baris data proposal dari Sheets
 * @param {string} stageKey     - Key tahap
 * @param {number} [optPutaran] - Nomor putaran revisi jika stageKey === "REVISI"
 * @returns {Folder}            - Google Drive Folder object
 */
function getStageFolder(row, stageKey, optPutaran) {
  var folderIds = {};
  try {
    folderIds = JSON.parse(row[COL.FOLDER_IDS_JSON] || "{}");
  } catch (e) {
    folderIds = {};
  }
  
  var stageFolderId = folderIds[stageKey];
  if (!stageFolderId) {
    throw new Error("Folder ID untuk tahap '" + stageKey + "' tidak ditemukan.");
  }
  
  var stageFolder = DriveApp.getFolderById(stageFolderId);
  if (stageKey === "REVISI") {
    var putaranNo = optPutaran || parseInt(row[COL.REVISI_ROUND] || "0", 10);
    if (putaranNo <= 0) {
      throw new Error("Nomor putaran revisi tidak valid (" + putaranNo + ").");
    }
    var namaPutaran = formatNamaPutaran(putaranNo);
    var iter = stageFolder.getFoldersByName(namaPutaran);
    if (!iter.hasNext()) {
      throw new Error("Subfolder putaran revisi '" + namaPutaran + "' tidak ditemukan.");
    }
    return iter.next();
  }
  
  return stageFolder;
}

/**
 * Mengambil subfolder jenis dokumen tertentu di dalam folder tahap, buat jika belum ada.
 *
 * @param {Folder} parentFolder - Folder tahap
 * @param {string} typeName     - Nama subfolder jenis dokumen
 * @returns {Folder}            - Folder jenis dokumen
 */
function getTypeFolder(parentFolder, typeName) {
  var iter = parentFolder.getFoldersByName(typeName);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(typeName);
}

/**
 * Menyalin dokumen aktif (Formulir Google Doc, file Kajian PDF aktif, file Foto aktif, dan video .txt URL file)
 * dari folder tahap asal ke folder tahap tujuan, lalu memperbarui record database dengan ID file baru.
 *
 * @param {string} proposalId       - ID usulan (contoh: "WBTB-001")
 * @param {string} sourceStageKey   - Key tahap asal
 * @param {string} destStageKey     - Key tahap tujuan
 * @param {number} [optSourcePutaranNo] - Nomor putaran revisi jika asal adalah "REVISI"
 * @param {number} [optDestPutaranNo]   - Nomor putaran revisi jika tujuan adalah "REVISI"
 * @param {Sheet} [optSheetTx]          - Objek sheet dari transaksi aktif (jika dipanggil dalam transaksi)
 */
function copyActiveFilesToStage(proposalId, sourceStageKey, destStageKey, optSourcePutaranNo, optDestPutaranNo, optSheetTx) {
  writeAuditLog(
    ACTION_TYPES.STATUS_CHANGE,
    "Memulai penyalinan berkas aktif " + proposalId + " dari tahap " + sourceStageKey + " ke " + destStageKey,
    proposalId
  );

  var sheet = optSheetTx || DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
  var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
  if (!hasil) {
    throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan untuk penyalinan file.");
  }
  
  var row = hasil.rowData;
  var rowIndex = hasil.rowIndex;

  var sourceFolder = getStageFolder(row, sourceStageKey, optSourcePutaranNo);
  var destFolder   = getStageFolder(row, destStageKey, optDestPutaranNo);

  // 1. Salin Google Doc Formulir Usulan
  var docActiveId = row[COL.DOC_ACTIVE_ID];
  var newDocId = docActiveId;
  var docHistory = {};
  try {
    docHistory = JSON.parse(row[COL.DOC_HISTORY_JSON] || "{}");
  } catch(e) {}

  if (docActiveId) {
    try {
      var fileObj = DriveApp.getFileById(docActiveId);
      var destFormulirFolder = getTypeFolder(destFolder, FOLDER_NAMES.JENIS.FORMULIR_USULAN);
      var copiedDoc = fileObj.makeCopy(fileObj.getName(), destFormulirFolder);
      newDocId = copiedDoc.getId();
      
      // Update doc_history untuk memetakan key versi ke ID baru
      for (var key in docHistory) {
        if (docHistory[key] === docActiveId) {
          docHistory[key] = newDocId;
        }
      }
    } catch(errDoc) {
      Logger.log("Gagal menyalin formulir: " + errDoc.toString());
      throw new Error("Gagal menyalin Formulir Usulan ke folder tahap berikutnya: " + errDoc.message);
    }
  }

  // 2. Salin Kajian PDF (hanya yang berstatus 'aktif')
  var kajianFiles = [];
  try {
    kajianFiles = JSON.parse(row[COL.KAJIAN_FILES_JSON] || "[]");
  } catch(e) {}
  
  var destKajianFolder = getTypeFolder(destFolder, FOLDER_NAMES.JENIS.KAJIAN_ILMIAH);
  for (var i = 0; i < kajianFiles.length; i++) {
    var fileEntry = kajianFiles[i];
    if (fileEntry.status === "aktif" && fileEntry.fileId) {
      try {
        var fileObj = DriveApp.getFileById(fileEntry.fileId);
        var copiedFile = fileObj.makeCopy(fileObj.getName(), destKajianFolder);
        fileEntry.fileId = copiedFile.getId();
      } catch (errKajian) {
        Logger.log("Gagal menyalin kajian: " + fileEntry.name + " (" + errKajian.toString() + ")");
        throw new Error("Gagal menyalin Kajian Ilmiah '" + fileEntry.name + "' ke folder tahap berikutnya: " + errKajian.message);
      }
    }
  }

  // 3. Salin Foto Dokumentasi (hanya yang berstatus 'aktif')
  var fotoFiles = [];
  try {
    fotoFiles = JSON.parse(row[COL.FOTO_FILES_JSON] || "[]");
  } catch(e) {}

  var destFotoFolder = getTypeFolder(destFolder, FOLDER_NAMES.JENIS.FOTO_DOKUMENTASI);
  for (var i = 0; i < fotoFiles.length; i++) {
    var fileEntry = fotoFiles[i];
    if (fileEntry.status === "aktif" && fileEntry.fileId) {
      try {
        var fileObj = DriveApp.getFileById(fileEntry.fileId);
        var copiedFile = fileObj.makeCopy(fileObj.getName(), destFotoFolder);
        fileEntry.fileId = copiedFile.getId();
      } catch (errFoto) {
        Logger.log("Gagal menyalin foto: " + fileEntry.name + " (" + errFoto.toString() + ")");
        throw new Error("Gagal menyalin Foto '" + fileEntry.name + "' ke folder tahap berikutnya: " + errFoto.message);
      }
    }
  }

  // 4. Salin file .txt Video URL
  var destVideoFolder = getTypeFolder(destFolder, FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
  try {
    var sourceVideoFolder = getTypeFolder(sourceFolder, FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
    var filesIter = sourceVideoFolder.getFiles();
    while (filesIter.hasNext()) {
      var file = filesIter.next();
      if (file.getMimeType() === "text/plain") {
        file.makeCopy(file.getName(), destVideoFolder);
      }
    }
  } catch (errVideo) {
    Logger.log("Gagal menyalin video URL .txt: " + errVideo.toString());
    throw new Error("Gagal menyalin berkas Video URL ke folder tahap berikutnya: " + errVideo.message);
  }

  // Helper untuk melakukan update database
  var updateDB = function(targetSheet) {
    var hasilTx = DatabaseEngine.findRow(targetSheet, COL.ID, proposalId);
    if (!hasilTx) throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan saat transaksi database.");
    var rowIdx = hasilTx.rowIndex;

    targetSheet.getRange(rowIdx, COL.DOC_ACTIVE_ID + 1).setValue(newDocId);
    targetSheet.getRange(rowIdx, COL.DOC_HISTORY_JSON + 1).setValue(JSON.stringify(docHistory));
    targetSheet.getRange(rowIdx, COL.KAJIAN_FILES_JSON + 1).setValue(JSON.stringify(kajianFiles));
    targetSheet.getRange(rowIdx, COL.FOTO_FILES_JSON + 1).setValue(JSON.stringify(fotoFiles));
    targetSheet.getRange(rowIdx, COL.UPDATED_AT + 1).setValue(new Date());
  };

  // 5. Update database dengan ID berkas baru
  if (optSheetTx) {
    updateDB(optSheetTx);
  } else {
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
      updateDB(sheetTx);
    });
  }

  writeAuditLog(
    ACTION_TYPES.STATUS_CHANGE,
    "Berhasil menyalin berkas aktif " + proposalId + " dari tahap " + sourceStageKey + " ke " + destStageKey,
    proposalId
  );
}
