/**
 * JONG WBTb — Modul Penetapan Operator & Perintah Akses Tertulis
 * Sesuai Juknis Tata Kelola Dokumen Digital WBTb 2026 Revisi 2
 * Bab II huruf B & C
 *
 * FLOW PENETAPAN OPERATOR:
 * 1. Atasan login ke sistem
 * 2. Atasan pilih Anggota Tim yang akan ditetapkan sebagai Operator
 * 3. Sistem generate dokumen penetapan PDF
 * 4. PDF disimpan di JONG_WBTB_ADMINISTRASI/PENETAPAN_OPERATOR/
 * 5. Sistem update role di db_users
 * 6. Audit log dicatat
 *
 * FLOW PERINTAH AKSES TERTULIS:
 * 1. Atasan instruksikan tambah/cabut akses via UI sistem
 * 2. Sistem generate dokumen perintah akses PDF
 * 3. PDF disimpan di JONG_WBTB_ADMINISTRASI/PERINTAH_AKSES/
 * 4. Operator eksekusi perubahan akses berdasarkan perintah tertulis
 *
 * CATATAN DEVELOPER:
 * - Dokumen PDF bersifat final — tidak bisa diedit setelah diterbitkan
 * - Folder JONG_WBTB_ADMINISTRASI terpisah dari WBTB_LINGGA_2026
 * - Hanya Atasan yang bisa menerbitkan penetapan dan perintah akses
 */


// ─────────────────────────────────────────────
// 1. KONSTANTA FOLDER ADMINISTRASI
// ─────────────────────────────────────────────

var FOLDER_ADMIN = {
  ROOT               : "JONG_WBTB_ADMINISTRASI",
  PENETAPAN_OPERATOR : "PENETAPAN_OPERATOR",
  PERINTAH_AKSES     : "PERINTAH_AKSES"
};


// ─────────────────────────────────────────────
// 2. HELPER: GET OR CREATE FOLDER ADMINISTRASI
// ─────────────────────────────────────────────

/**
 * Mengambil atau membuat folder administrasi JONG WBTb.
 * Terpisah dari folder data WBTb.
 *
 * @param {string} subfolderNama - Nama subfolder (dari FOLDER_ADMIN)
 * @returns {Folder}             - Google Drive Folder object
 */
function getFolderAdminRoot() {
  return getOrCreateFolder(DriveApp.getRootFolder(), FOLDER_ADMIN.ROOT);
}

function getFolderAdminSub(subfolderNama) {
  var root = getFolderAdminRoot();
  return getOrCreateFolder(root, subfolderNama);
}


// ─────────────────────────────────────────────
// 3. GENERATE PDF VIA GOOGLE DOCS TEMPLATE
//
// Cara yang supported: buat Google Docs dulu,
// isi kontennya, export ke PDF, hapus Docs-nya.
// ─────────────────────────────────────────────

/**
 * Membuat file PDF dari konten teks yang diberikan.
 * Internaly membuat Google Docs sementara, export PDF, lalu hapus Docs-nya.
 *
 * @param {string} judulDokumen  - Judul dokumen (untuk nama file PDF)
 * @param {string} isiDokumen    - Konten dokumen dalam format teks plain
 * @param {Folder} folderTujuan  - Google Drive Folder tujuan penyimpanan PDF
 * @returns {File}               - Google Drive File object (PDF)
 */
function generatePDF(judulDokumen, isiDokumen, folderTujuan) {

  var docTemp  = DocumentApp.create(judulDokumen + "_TEMP");
  var body     = docTemp.getBody();

  body.clear();
  body.setText(isiDokumen);

  body.getParagraphs().forEach(function(p) {
    p.setFontFamily("Arial");
    p.setFontSize(11);
  });

  docTemp.saveAndClose();

  var fileDoc  = DriveApp.getFileById(docTemp.getId());
  var pdfBlob  = fileDoc.getAs(MimeType.PDF);
  pdfBlob.setName(judulDokumen + ".pdf");

  var filePDF  = folderTujuan.createFile(pdfBlob);

  fileDoc.setTrashed(true);

  return filePDF;
}


// ─────────────────────────────────────────────
// 4. PENETAPAN OPERATOR
//
// Operator ditetapkan secara tertulis oleh Atasan.
// Penetapan disampaikan kepada seluruh Anggota Tim.
// ─────────────────────────────────────────────

/**
 * Menetapkan Operator baru dan menerbitkan dokumen penetapan PDF.
 * Hanya bisa dieksekusi oleh Atasan.
 *
 * Jika sudah ada Operator aktif, fungsi ini akan:
 * - Mencabut role Operator lama
 * - Menerbitkan penetapan Operator baru
 *
 * @param {string} atasanEmail       - Email Atasan yang menetapkan
 * @param {string} operatorEmailBaru - Email Anggota Tim yang ditetapkan sebagai Operator
 * @param {string} operatorNama      - Nama lengkap Operator baru
 * @param {string} catatan           - Catatan opsional (contoh: "Pengganti Operator lama karena mutasi")
 * @returns {object}                 - { pdfFileId, pdfNama, operatorEmail, operatorNama }
 */
function tetapkanOperator(atasanEmail, operatorEmailBaru, operatorNama, catatan) {

  // ── Validasi aktor ────────────────────────
  requireRole(atasanEmail, ROLES.ATASAN);

  // ── Ambil data Atasan untuk dokumen ──────
  var sheetUser  = DatabaseEngine.getSheet(DB_USERS);
  var hasilAtasan = DatabaseEngine.findRow(sheetUser, COL_USER.EMAIL, atasanEmail);
  var namAtasan  = hasilAtasan ? hasilAtasan.rowData[COL_USER.NAMA] : atasanEmail;

  // ── Cek apakah sudah ada Operator aktif ──
  var semuaUser  = getAllActiveUsers(atasanEmail);
  var operatorLama = semuaUser.operator.length > 0 ? semuaUser.operator[0] : null;

  var tanggalSekarang = Utilities.formatDate(
    new Date(), "Asia/Jakarta", "dd MMMM yyyy"
  );

  // ── Generate konten dokumen penetapan ────
  var nomorDokumen = "JONG-WBTb/PO/" +
    Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd") + "/" +
    String(Math.floor(Math.random() * 900) + 100);

  var isiDokumen = [
    "SURAT PENETAPAN OPERATOR",
    "SISTEM JONG WBTb — DINAS KEBUDAYAAN KABUPATEN LINGGA",
    "Nomor: " + nomorDokumen,
    "",
    "Pada hari ini, " + tanggalSekarang + ", saya yang bertanda tangan di bawah ini:",
    "",
    "Nama    : " + namAtasan,
    "Jabatan : Kepala Bidang NATBK Dinas Kebudayaan Kabupaten Lingga",
    "Email   : " + atasanEmail,
    "",
    "Dengan ini menetapkan:",
    "",
    "Nama    : " + operatorNama,
    "Email   : " + operatorEmailBaru,
    "Sebagai : OPERATOR Sistem JONG WBTb",
    "",
    "Operator memiliki kewenangan sebagai berikut:",
    "1. Mengelola akses sistem bagi seluruh Anggota Tim.",
    "2. Mencatat status dan riwayat perubahan Folder Usulan.",
    "3. Memastikan keteraturan dan kelengkapan susunan folder.",
    "4. Mendokumentasikan seluruh aktivitas pengusulan WBTb.",
    "5. Mengeksekusi perubahan status atas dasar keputusan sah dari Atasan.",
    "",
    "Penetapan ini berlaku sejak tanggal ditetapkan.",
    "",
    catatan ? "Catatan: " + catatan : "",
    "",
    "Ditetapkan di : Daik Lingga",
    "Pada tanggal  : " + tanggalSekarang,
    "",
    "Kepala Bidang NATBK,",
    "",
    "",
    namAtasan,
    atasanEmail
  ].join("\n");

  // ── Simpan PDF ────────────────────────────
  var folderPenetapan = getFolderAdminSub(FOLDER_ADMIN.PENETAPAN_OPERATOR);
  var judulPDF = "PENETAPAN-OPERATOR_" +
    operatorNama.toUpperCase().replace(/\s+/g, "-") + "_" +
    Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd");

  var filePDF = generatePDF(judulPDF, isiDokumen, folderPenetapan);

  // ── Cabut Operator lama jika ada ─────────
  if (operatorLama && operatorLama.email !== operatorEmailBaru) {
    // Operator lama dicabut oleh sistem atas perintah Atasan
    // Bypass requireRole karena yang eksekusi adalah Atasan, bukan Operator
    DatabaseEngine.executeTransaction(DB_USERS, function(sheet) {
      var hasilLama = DatabaseEngine.findRow(sheet, COL_USER.EMAIL, operatorLama.email);
      if (hasilLama) {
        sheet.getRange(hasilLama.rowIndex, COL_USER.AKTIF + 1).setValue(false);
        sheet.getRange(hasilLama.rowIndex, COL_USER.DICABUT_AT + 1).setValue(new Date());
        sheet.getRange(hasilLama.rowIndex, COL_USER.DICABUT_OLEH + 1).setValue(atasanEmail);
        sheet.getRange(hasilLama.rowIndex, COL_USER.CATATAN + 1)
          .setValue("Digantikan oleh " + operatorNama + " per penetapan " + nomorDokumen);
      }
    });
    invalidateUserCache(operatorLama.email);

    writeAuditLog(
      ACTION_TYPES.AKSES_DICABUT,
      "Role Operator dicabut dari '" + operatorLama.email + "' " +
      "karena pergantian Operator. Nomor penetapan: " + nomorDokumen,
      null
    );
  }

  // ── Tambah Operator baru ──────────────────
  // Cek apakah email sudah terdaftar di db_users
  var sheetUserCheck = DatabaseEngine.getSheet(DB_USERS);
  var existingUser   = DatabaseEngine.findRow(sheetUserCheck, COL_USER.EMAIL, operatorEmailBaru);

  if (existingUser) {
    DatabaseEngine.executeTransaction(DB_USERS, function(sheet) {
      var h = DatabaseEngine.findRow(sheet, COL_USER.EMAIL, operatorEmailBaru);
      sheet.getRange(h.rowIndex, COL_USER.ROLE + 1).setValue(ROLES.OPERATOR);
      sheet.getRange(h.rowIndex, COL_USER.NAMA + 1).setValue(operatorNama);
      sheet.getRange(h.rowIndex, COL_USER.AKTIF + 1).setValue(true);
      sheet.getRange(h.rowIndex, COL_USER.DITAMBAH_AT + 1).setValue(new Date());
      sheet.getRange(h.rowIndex, COL_USER.DITAMBAH_OLEH + 1).setValue(atasanEmail);
      sheet.getRange(h.rowIndex, COL_USER.DICABUT_AT + 1).setValue("");
      sheet.getRange(h.rowIndex, COL_USER.DICABUT_OLEH + 1).setValue("");
      sheet.getRange(h.rowIndex, COL_USER.CATATAN + 1)
        .setValue("Ditetapkan sebagai Operator. Nomor: " + nomorDokumen);
    });
  } else {
    DatabaseEngine.executeTransaction(DB_USERS, function(sheet) {
      sheet.appendRow([
        operatorEmailBaru,
        ROLES.OPERATOR,
        operatorNama,
        true,
        new Date(),
        atasanEmail,
        "",
        "",
        "Ditetapkan sebagai Operator. Nomor: " + nomorDokumen
      ]);
    });
  }

  invalidateUserCache(operatorEmailBaru);

  writeAuditLog(
    ACTION_TYPES.AKSES_DITAMBAH,
    "Operator ditetapkan: '" + operatorNama + "' (" + operatorEmailBaru + "). " +
    "Nomor penetapan: " + nomorDokumen + ". " +
    "PDF ID: " + filePDF.getId() + ". " +
    "Ditetapkan oleh Atasan: " + atasanEmail,
    null
  );

  return {
    pdfFileId      : filePDF.getId(),
    pdfNama        : judulPDF + ".pdf",
    pdfUrl         : filePDF.getUrl(),
    nomorDokumen   : nomorDokumen,
    operatorEmail  : operatorEmailBaru,
    operatorNama   : operatorNama,
    tanggal        : tanggalSekarang
  };
}


// ─────────────────────────────────────────────
// 5. PERINTAH AKSES TERTULIS
//
// dapat dilakukan atas perintah tertulis Atasan.
// Setiap perubahan hak akses wajib didokumentasikan.
// ─────────────────────────────────────────────

/**
 * Menerbitkan perintah akses tertulis (PDF) dari Atasan ke Operator.
 * Dipanggil SEBELUM Operator eksekusi tambah/cabut akses via tambahAksesUser()
 * atau cabutAksesUser().
 *
 * @param {string} atasanEmail   - Email Atasan yang menerbitkan perintah
 * @param {string} targetEmail   - Email pengguna yang aksesnya akan diubah
 * @param {string} targetNama    - Nama pengguna target
 * @param {string} tindakan      - "TAMBAH" atau "CABUT"
 * @param {string} roleTarGet    - Role yang ditambah/dicabut (dari ROLES)
 * @param {string} alasan        - Alasan perubahan akses
 * @returns {object}             - { pdfFileId, pdfNama, nomorPerintah }
 */
function terbitkanPerintahAkses(atasanEmail, targetEmail, targetNama,
                                 tindakan, roleTarget, alasan) {

  // ── Validasi aktor ────────────────────────
  requireRole(atasanEmail, ROLES.ATASAN);

  // ── Validasi tindakan ─────────────────────
  if (["TAMBAH", "CABUT"].indexOf(tindakan) === -1) {
    throw new Error("Tindakan tidak valid. Pilih: TAMBAH atau CABUT.");
  }

  // ── Validasi role target ──────────────────
  var rolesValid = Object.values(ROLES);
  if (rolesValid.indexOf(roleTarget) === -1) {
    throw new Error("Role tidak valid: " + roleTarget);
  }

  // ── Ambil nama Atasan ─────────────────────
  var sheetUser   = DatabaseEngine.getSheet(DB_USERS);
  var hasilAtasan = DatabaseEngine.findRow(sheetUser, COL_USER.EMAIL, atasanEmail);
  var namaAtasan  = hasilAtasan ? hasilAtasan.rowData[COL_USER.NAMA] : atasanEmail;

  var tanggalSekarang = Utilities.formatDate(
    new Date(), "Asia/Jakarta", "dd MMMM yyyy"
  );

  var nomorPerintah = "JONG-WBTb/PA/" +
    Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd") + "/" +
    String(Math.floor(Math.random() * 900) + 100);

  // ── Generate konten perintah ──────────────
  var isiDokumen = [
    "PERINTAH PERUBAHAN HAK AKSES",
    "SISTEM JONG WBTb — DINAS KEBUDAYAAN KABUPATEN LINGGA",
    "Nomor: " + nomorPerintah,
    "",
    "Pada hari ini, " + tanggalSekarang + ", saya yang bertanda tangan di bawah ini:",
    "",
    "Nama    : " + namaAtasan,
    "Jabatan : Kepala Bidang NATBK Dinas Kebudayaan Kabupaten Lingga",
    "Email   : " + atasanEmail,
    "",
    "Dengan ini memerintahkan kepada Operator Sistem JONG WBTb untuk:",
    "",
    "Tindakan : " + tindakan + " AKSES",
    "Pengguna : " + targetNama,
    "Email    : " + targetEmail,
    "Role     : " + roleTarget,
    "",
    "Alasan   : " + alasan,
    "",
    tindakan === "TAMBAH"
      ? "Pengguna di atas diberikan hak akses ke Sistem JONG WBTb dengan role " +
        roleTarget + " terhitung sejak tanggal perintah ini diterbitkan."
      : "Hak akses pengguna di atas dicabut dari Sistem JONG WBTb terhitung sejak " +
        "tanggal perintah ini diterbitkan. Pencabutan wajib dilaksanakan paling lambat " +
        "1 (satu) hari kerja sejak perintah ini diterima oleh Operator.",
    "",
    "Ditetapkan di : Daik Lingga",
    "Pada tanggal  : " + tanggalSekarang,
    "",
    "Kepala Bidang NATBK,",
    "",
    "",
    namaAtasan,
    atasanEmail
  ].join("\n");

  // ── Simpan PDF ────────────────────────────
  var folderPerintah = getFolderAdminSub(FOLDER_ADMIN.PERINTAH_AKSES);
  var judulPDF = "PERINTAH-AKSES_" + tindakan + "_" +
    targetNama.toUpperCase().replace(/\s+/g, "-") + "_" +
    Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd");

  var filePDF = generatePDF(judulPDF, isiDokumen, folderPerintah);

  writeAuditLog(
    tindakan === "TAMBAH" ? ACTION_TYPES.AKSES_DITAMBAH : ACTION_TYPES.AKSES_DICABUT,
    "Perintah akses tertulis diterbitkan. Nomor: " + nomorPerintah + ". " +
    "Tindakan: " + tindakan + " akses untuk '" + targetEmail + "' (" + roleTarget + "). " +
    "Alasan: " + alasan + ". PDF ID: " + filePDF.getId(),
    null
  );

  return {
    pdfFileId    : filePDF.getId(),
    pdfNama      : judulPDF + ".pdf",
    pdfUrl       : filePDF.getUrl(),
    nomorPerintah: nomorPerintah,
    tindakan     : tindakan,
    targetEmail  : targetEmail,
    targetNama   : targetNama,
    roleTarget   : roleTarget,
    tanggal      : tanggalSekarang
  };
}
