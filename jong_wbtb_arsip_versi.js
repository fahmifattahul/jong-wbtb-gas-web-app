/**
 * JONG WBTb — Modul Arsip Versi
 * Sesuai Juknis Tata Kelola Dokumen Digital WBTb 2026 Revisi 2
 * Bab VI huruf B, C & D
 *
 * PRINSIP UTAMA (Juknis Bab VI huruf C):
 * "Dilarang menghapus atau menimpa versi lama dokumen dalam keadaan apapun.
 *  Sebelum versi baru disimpan, versi yang sedang aktif wajib dipindahkan
 *  terlebih dahulu ke subfolder arsip versi yang sesuai."
 *
 * BEHAVIOR PER JENIS DOKUMEN:
 * - Formulir  : satu file aktif — arsip seluruhnya saat naik versi
 * - Kajian    : multi-file — arsip per-file yang diganti/dihapus
 * - Foto      : multi-file — arsip per-file yang diganti/dihapus
 *               file yang tidak berubah tetap di tempat
 * - Video     : arsip file .txt URL lama saat URL diganti
 *
 * TRIGGER: Opsi A — user eksplisit pilih file lama yang diganti saat upload.
 *          Sistem otomatis arsipkan file lama sebelum simpan file baru (client-side trigger).
 *
 * CATATAN DEVELOPER:
 * - Semua fungsi arsip harus dipanggil SEBELUM file baru disimpan.
 * - Jangan pernah hapus file dari Drive — hanya pindahkan ke ARSIP-VERSI.
 * - Update metadata JSON di sheet setelah setiap operasi arsip.
 */


// ─────────────────────────────────────────────
// 1. HELPER: AMBIL SUBFOLDER ARSIP-VERSI
// ─────────────────────────────────────────────

/**
 * Mengambil subfolder ARSIP-VERSI di dalam subfolder jenis dokumen.
 * Throw error jika tidak ditemukan — struktur folder harus sudah diinisialisasi.
 *
 * @param {string} folderJenisId - Google Drive ID subfolder jenis dokumen
 *                                 (contoh: ID folder FORMULIR-USULAN)
 * @returns {Folder} - Google Drive Folder object ARSIP-VERSI
 */
function getArsipVersiFolder(folderJenisId) {
  var folderJenis = DriveApp.getFolderById(folderJenisId);
  var iter        = folderJenis.getFoldersByName(FOLDER_NAMES.JENIS.ARSIP_VERSI);
  if (!iter.hasNext()) {
    throw new Error(
      "Subfolder " + FOLDER_NAMES.JENIS.ARSIP_VERSI +
      " tidak ditemukan di folder ID: " + folderJenisId +
      ". Pastikan workspace sudah diinisialisasi via initProposalWorkspace()."
    );
  }
  return iter.next();
}


// ─────────────────────────────────────────────
// 2. ARSIP VERSI: FORMULIR USULAN
//
// file baru (salinan) dibuat di FORMULIR-USULAN/.
// Juknis Bab VI huruf C.
// ─────────────────────────────────────────────

/**
 * Mengarsipkan formulir usulan versi lama dan membuat salinan versi baru.
 * Dipanggil otomatis saat perubahan substansial pada formulir (naik versi).
 *
 * @param {string} proposalId       - ID usulan (contoh: "WBTB-001")
 * @param {string} folderJenisId    - Google Drive ID folder FORMULIR-USULAN aktif
 * @param {string} docActiveId      - Google Docs ID formulir versi aktif saat ini
 * @param {number} versiLama        - Nomor versi aktif saat ini (integer)
 * @param {string} aktorEmail       - Email pengguna yang melakukan perubahan
 * @returns {object}                - { arsipFileId, newDocId, versiLama, versiBaru }
 */
function arsipFormulirVersi(proposalId, folderJenisId, docActiveId, versiLama, aktorEmail) {

  var versiBaru       = versiLama + 1;
  var folderJenis     = DriveApp.getFolderById(folderJenisId);
  var folderArsip     = getArsipVersiFolder(folderJenisId);
  var fileAktif       = DriveApp.getFileById(docActiveId);
  var namaFileAktif   = fileAktif.getName();

  // 1. Buat salinan sebagai versi baru di FORMULIR-USULAN/
  var namaVersiLamaPattern = new RegExp("_v" + versiLama + "$");
  var namaFileBaru = namaFileAktif.replace(namaVersiLamaPattern, "_v" + versiBaru);

  var fileBaru  = fileAktif.makeCopy(namaFileBaru, folderJenis);
  var newDocId  = fileBaru.getId();

  writeAuditLog(
    ACTION_TYPES.FORMULIR_VERSI_BARU,
    "Formulir v" + versiBaru + " dibuat. File ID: " + newDocId +
    ". Salinan dari v" + versiLama + " (ID: " + docActiveId + ").",
    proposalId
  );

  // 2. Pindahkan file lama ke ARSIP-VERSI (move, bukan copy)
  fileAktif.moveTo(folderArsip);

  writeAuditLog(
    ACTION_TYPES.ARSIP_VERSI_PINDAH,
    "Formulir v" + versiLama + " dipindah ke ARSIP-VERSI. File ID: " + docActiveId,
    proposalId
  );

  return {
    arsipFileId : docActiveId,
    newDocId    : newDocId,
    versiLama   : versiLama,
    versiBaru   : versiBaru
  };
}


// ─────────────────────────────────────────────
// 3. ARSIP VERSI: KAJIAN ILMIAH
//
// berubah tetap di tempat.
// User eksplisit pilih fileId lama yang diganti.
// ─────────────────────────────────────────────

/**
 * Mengarsipkan satu file kajian ilmiah yang diganti oleh file baru.
 * Dipanggil otomatis saat user upload kajian baru dan pilih file lama yang diganti.
 *
 * @param {string} proposalId    - ID usulan
 * @param {string} folderJenisId - Google Drive ID folder KAJIAN-ILMIAH aktif
 * @param {string} fileIdLama    - Google Drive ID file kajian lama yang diganti
 * @param {string} aktorEmail    - Email pengguna
 * @returns {object}             - { arsipFileId, namaFile }
 */
function arsipKajianFile(proposalId, folderJenisId, fileIdLama, aktorEmail) {

  var folderJenis   = DriveApp.getFolderById(folderJenisId);
  var folderArsip   = getArsipVersiFolder(folderJenisId);
  var fileLama      = DriveApp.getFileById(fileIdLama);
  var namaFile      = fileLama.getName();

  fileLama.moveTo(folderArsip);

  writeAuditLog(
    ACTION_TYPES.ARSIP_VERSI_PINDAH,
    "Kajian '" + namaFile + "' dipindah ke ARSIP-VERSI. File ID: " + fileIdLama,
    proposalId
  );

  return {
    arsipFileId : fileIdLama,
    namaFile    : namaFile
  };
}


// ─────────────────────────────────────────────
// 4. ARSIP VERSI: FOTO DOKUMENTASI
//
// berubah tetap di tempat.
// User eksplisit pilih fileId lama yang diganti.
// ─────────────────────────────────────────────

/**
 * Mengarsipkan satu file foto yang diganti oleh foto baru.
 * Dipanggil otomatis saat user upload foto baru dan pilih file lama yang diganti.
 *
 * @param {string} proposalId    - ID usulan
 * @param {string} folderJenisId - Google Drive ID folder FOTO-DOKUMENTASI aktif
 * @param {string} fileIdLama    - Google Drive ID file foto lama yang diganti
 * @param {string} aktorEmail    - Email pengguna
 * @returns {object}             - { arsipFileId, namaFile }
 */
function arsipFotoFile(proposalId, folderJenisId, fileIdLama, aktorEmail) {

  var folderJenis   = DriveApp.getFolderById(folderJenisId);
  var folderArsip   = getArsipVersiFolder(folderJenisId);
  var fileLama      = DriveApp.getFileById(fileIdLama);
  var namaFile      = fileLama.getName();

  fileLama.moveTo(folderArsip);

  writeAuditLog(
    ACTION_TYPES.ARSIP_VERSI_PINDAH,
    "Foto '" + namaFile + "' dipindah ke ARSIP-VERSI. File ID: " + fileIdLama,
    proposalId
  );

  return {
    arsipFileId : fileIdLama,
    namaFile    : namaFile
  };
}


// ─────────────────────────────────────────────
// 5. ARSIP VERSI: VIDEO (URL)
//
// ARSIP-VERSI, file .txt baru dibuat.
// Juknis Bab IV huruf C & Bab VI huruf C.
// ─────────────────────────────────────────────

/**
 * Mengarsipkan file .txt URL video lama dan membuat file .txt baru dengan URL baru.
 * Dipanggil otomatis saat user mengganti URL video.
 *
 * Format isi file .txt:
 * URL: https://youtube.com/watch?v=xxx
 * Diunggah oleh: email@linggakab.go.id
 * Tanggal: 2026-05-23
 * Keterangan: [keterangan opsional dari user]
 *
 * @param {string} proposalId       - ID usulan
 * @param {string} namaKarya        - Nama karya (untuk penamaan file)
 * @param {string} folderJenisId    - Google Drive ID folder VIDEO-DOKUMENTASI aktif
 * @param {string} fileIdLama       - Google Drive ID file .txt URL lama (null jika belum ada)
 * @param {string} urlBaru          - URL video baru
 * @param {string} keterangan       - Keterangan opsional dari user
 * @param {number} nomorUrut        - Nomor urut video (untuk penamaan file)
 * @param {string} aktorEmail       - Email pengguna
 * @returns {object}                - { arsipFileId, newFileId, namaFileBaru }
 */
function arsipVideoUrl(proposalId, judulSingkat, folderJenisId, fileIdLama,
                       urlBaru, keterangan, nomorUrut, aktorEmail) {

  var folderJenis = DriveApp.getFolderById(folderJenisId);
  var arsipFileId = null;

  // 1. Arsipkan file .txt lama jika ada
  if (fileIdLama) {
    var folderArsip = getArsipVersiFolder(folderJenisId);
    var fileLama    = DriveApp.getFileById(fileIdLama);
    fileLama.moveTo(folderArsip);
    arsipFileId = fileIdLama;

    writeAuditLog(
      ACTION_TYPES.ARSIP_VERSI_PINDAH,
      "File URL video lama dipindah ke ARSIP-VERSI. File ID: " + fileIdLama,
      proposalId
    );
  }

  // 2. Buat file .txt baru dengan URL baru
  var namaFileBaru  = namaFile(JENIS_DOK.VIDEO_TXT, judulSingkat, { nomorUrut: nomorUrut });

  var isiFile = [
    "URL: " + urlBaru,
    "Diunggah oleh: " + aktorEmail,
    "Tanggal: " + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss"),
    "Keterangan: " + (keterangan || "-")
  ].join("\n");

  var blob        = Utilities.newBlob(isiFile, "text/plain", namaFileBaru);
  var fileBaru    = folderJenis.createFile(blob);
  var newFileId   = fileBaru.getId();

  writeAuditLog(
    ACTION_TYPES.VIDEO_URL_SET,
    "URL video baru disimpan. File ID: " + newFileId + ". URL: " + urlBaru,
    proposalId
  );

  return {
    arsipFileId  : arsipFileId,
    newFileId    : newFileId,
    namaFileBaru : namaFileBaru
  };
}


// ─────────────────────────────────────────────
// 6. UPDATE METADATA JSON DI SHEET
//
// Setiap operasi arsip harus diikuti update
// metadata di kolom JSON yang relevan.
// ─────────────────────────────────────────────

/**
 * Memperbarui metadata file di kolom JSON sheet db_wbtb_lingga.
 * Dipanggil setelah setiap operasi arsip atau upload file baru.
 *
 * @param {string} proposalId  - ID usulan
 * @param {number} colIndex    - Index kolom JSON yang diupdate (dari konstanta COL)
 * @param {*}      nilaiJson   - Nilai baru (akan di-JSON.stringify)
 */
function updateFileMetadata(proposalId, colIndex, nilaiJson) {
  DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) {
      throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan.");
    }

    sheet.getRange(hasil.rowIndex, colIndex + 1).setValue(JSON.stringify(nilaiJson));
    sheet.getRange(hasil.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
  });
}


/**
 * Membangun objek metadata file baru untuk disimpan di JSON kolom.
 * Konsisten dipakai untuk kajian, foto, dan video.
 *
 * @param {string} fileId      - Google Drive File ID
 * @param {string} nama        - Nama file
 * @param {number} versi       - Nomor versi file ini
 * @param {string} uploadedBy  - Email uploader
 * @returns {object}           - Metadata file
 */
function buildFileMetadata(fileId, nama, versi, uploadedBy) {
  return {
    fileId      : fileId,
    name        : nama,
    versi       : versi,
    status      : "aktif",
    uploadedAt  : new Date().toISOString(),
    uploadedBy  : uploadedBy,
    arsipFileId : null           // diisi saat file ini diarsipkan
  };
}


/**
 * Menandai file lama sebagai "diarsip" di metadata JSON.
 * Dipanggil setelah file lama berhasil dipindah ke ARSIP-VERSI.
 *
 * @param {Array}  fileArray   - Array metadata file (dari JSON kolom)
 * @param {string} fileIdLama  - File ID yang baru diarsipkan
 * @param {string} arsipFileId - File ID di lokasi ARSIP-VERSI (sama, ID tidak berubah)
 * @returns {Array}            - Array metadata yang sudah diupdate
 */
function tandaiFileDiarsip(fileArray, fileIdLama, arsipFileId) {
  return fileArray.map(function(item) {
    if (item.fileId === fileIdLama) {
      return Object.assign({}, item, {
        status      : "diarsip",
        arsipFileId : arsipFileId
      });
    }
    return item;
  });
}
