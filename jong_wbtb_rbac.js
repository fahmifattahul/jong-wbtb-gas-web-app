/**
 * JONG WBTb — Modul RBAC (Role-Based Access Control)
 * Sesuai Juknis Tata Kelola Dokumen Digital WBTb 2026 Revisi 2
 * Bab II huruf B & C, Bab VII huruf A
 *
 * ARSITEKTUR RBAC:
 * - Role disimpan di sheet db_users (bukan hardcode di kode)
 * - Sheet db_users diproteksi di Google Sheets — hanya Operator yang bisa edit
 * - Perubahan akses hanya lewat UI sistem (form tambah/cabut user)
 * - Setiap perubahan akses wajib tercatat di audit log
 *
 * CATATAN DEVELOPER:
 * - getUserRole() adalah fungsi yang paling sering dipanggil di seluruh sistem.
 *   Hasilnya di-cache per session via CacheService untuk mengurangi Sheet read.
 * - Jangan pernah bypass getUserRole() dengan hardcode role di tempat lain.
 * - Pencabutan akses harus terjadi maksimal 1 hari kerja setelah perintah Atasan.
 *   Juknis Bab II huruf C.
 */


// ─────────────────────────────────────────────
// 1. KONSTANTA SCHEMA db_users
// ─────────────────────────────────────────────

var DB_USERS = "db_users";

var COL_USER = {
  EMAIL       : 0,  // String  | PK | Email Google Workspace pengguna
  ROLE        : 1,  // String  | Salah satu dari ROLES
  NAMA        : 2,  // String  | Nama lengkap pengguna
  AKTIF       : 3,  // Boolean | TRUE = aktif, FALSE = akses dicabut
  DITAMBAH_AT : 4,  // Date    | Tanggal akses ditambahkan
  DITAMBAH_OLEH : 5, // String | Email Operator yang menambahkan
  DICABUT_AT  : 6,  // Date    | Tanggal akses dicabut (null jika masih aktif)
  DICABUT_OLEH: 7,  // String  | Email Operator yang mencabut (null jika masih aktif)
  CATATAN     : 8   // String  | Catatan opsional (contoh: "Mutasi per Juni 2026")
};

var TOTAL_COLS_USERS = 9;

var HEADERS_USERS = [
  "email",
  "role",
  "nama",
  "aktif",
  "ditambah_at",
  "ditambah_oleh",
  "dicabut_at",
  "dicabut_oleh",
  "catatan"
];

var CACHE_KEY_ROLE = "user_role_";
var CACHE_TTL      = 300;


// ─────────────────────────────────────────────
// 2. INISIALISASI SHEET db_users
// ─────────────────────────────────────────────

/**
 * Membuat sheet db_users jika belum ada.
 * Dipanggil dari initializeDatabase() — tidak perlu dipanggil terpisah.
 *
 * PENTING SETELAH SETUP:
 * Proteksi sheet db_users harus dilakukan manual di Google Sheets:
 * Data → Protect sheets and ranges → pilih sheet db_users →
 * "Restrict who can edit this range" → tambah email Operator saja.
 */
function initializeUsersSheet() {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var sheetUser = ss.getSheetByName(DB_USERS);

  if (!sheetUser) {
    sheetUser = ss.insertSheet(DB_USERS);
    sheetUser.appendRow(HEADERS_USERS);
    sheetUser.setFrozenRows(1);
    sheetUser.getRange(1, 1, 1, TOTAL_COLS_USERS)
      .setFontWeight("bold")
      .setBackground("#E6F4EA");
    Logger.log("Sheet '" + DB_USERS + "' berhasil dibuat.");
    Logger.log("PENTING: Proteksi sheet db_users secara manual di Google Sheets UI.");
    Logger.log("Hanya email Operator yang boleh edit sheet ini.");
  } else {
    Logger.log("Sheet '" + DB_USERS + "' sudah ada — dilewati.");
  }

  return sheetUser;
}


// ─────────────────────────────────────────────
// 3. GET USER ROLE
//
// Fungsi utama RBAC — dipanggil di seluruh sistem
// sebelum setiap operasi yang butuh validasi peran.
// ─────────────────────────────────────────────

/**
 * Mengambil role pengguna berdasarkan email.
 * Hasil di-cache 5 menit via CacheService untuk mengurangi Sheet read.
 *
 * Return null jika email tidak ditemukan atau akses sudah dicabut.
 * Caller harus handle null — jangan assume semua user punya role.
 *
 * @param {string} email - Email pengguna Google Workspace
 * @returns {string|null} - Nilai dari ROLES, atau null jika tidak ditemukan/tidak aktif
 */
function getUserRole(email) {
  if (!email) return null;

  var cache     = CacheService.getScriptCache();
  var cacheKey  = CACHE_KEY_ROLE + email;
  var cached    = cache.get(cacheKey);
  if (cached !== null) {
    return cached === "null" ? null : cached;
  }

  var sheet  = DatabaseEngine.getSheet(DB_USERS);
  var result = DatabaseEngine.findRow(sheet, COL_USER.EMAIL, email);

  var role = null;
  if (result) {
    var aktif = result.rowData[COL_USER.AKTIF];
    if (aktif === true || aktif === "TRUE") {
      role = result.rowData[COL_USER.ROLE] || null;
    }
  }

  cache.put(cacheKey, role === null ? "null" : role, CACHE_TTL);

  return role;
}


/**
 * Memvalidasi bahwa pengguna aktif memiliki role yang diizinkan.
 * Throw error jika tidak memiliki akses — dipakai di semua fungsi yang butuh otorisasi.
 *
 * @param {string}          email         - Email pengguna aktif
 * @param {string|string[]} rolesIzinkan  - Role yang diizinkan (string atau array string)
 * @returns {string}                      - Role pengguna yang tervalidasi
 */
function requireRole(email, rolesIzinkan) {
  var role = getUserRole(email);

  if (!role) {
    throw new Error(
      "Akses ditolak: '" + email + "' tidak terdaftar atau akses sudah dicabut. " +
      "Hubungi Operator untuk pendaftaran akses."
    );
  }

  var izinkanArray = Array.isArray(rolesIzinkan) ? rolesIzinkan : [rolesIzinkan];
  if (izinkanArray.indexOf(role) === -1) {
    throw new Error(
      "Akses ditolak: peran '" + role + "' tidak memiliki izin untuk operasi ini. " +
      "Diperlukan peran: " + izinkanArray.join(" atau ") + "."
    );
  }

  return role;
}


// ─────────────────────────────────────────────
// 4. TAMBAH AKSES PENGGUNA
//
// Penambahan akses hanya atas perintah tertulis Atasan.
// Dieksekusi oleh Operator.
// ─────────────────────────────────────────────

/**
 * Menambahkan pengguna baru ke sistem dengan role tertentu.
 * Hanya bisa dieksekusi oleh Operator.
 *
 * @param {string} operatorEmail  - Email Operator yang mengeksekusi
 * @param {string} emailBaru      - Email pengguna yang ditambahkan
 * @param {string} roleBaru       - Role yang diberikan (dari ROLES)
 * @param {string} namaBaru       - Nama lengkap pengguna
 * @param {string} catatan        - Catatan opsional (contoh: referensi surat perintah Atasan)
 * @returns {object}              - Data pengguna yang baru ditambahkan
 */
function tambahAksesUser(operatorEmail, emailBaru, roleBaru, namaBaru, catatan) {

  // Validasi: hanya Operator yang bisa tambah akses
  requireRole(operatorEmail, ROLES.OPERATOR);

  var rolesValid = Object.values(ROLES);
  if (rolesValid.indexOf(roleBaru) === -1) {
    throw new Error("Role '" + roleBaru + "' tidak valid. Pilih dari: " + rolesValid.join(", "));
  }

  // Validasi: tidak boleh ada dua Atasan
  if (roleBaru === ROLES.ATASAN) {
    var sheet    = DatabaseEngine.getSheet(DB_USERS);
    var data     = sheet.getDataRange().getValues();
    var adaAtasan = data.slice(1).some(function(row) {
      return row[COL_USER.ROLE] === ROLES.ATASAN &&
             (row[COL_USER.AKTIF] === true || row[COL_USER.AKTIF] === "TRUE");
    });
    if (adaAtasan) {
      throw new Error(
        "Sudah ada Atasan aktif di sistem. " +
        "Cabut akses Atasan lama terlebih dahulu sebelum menambah Atasan baru."
      );
    }
  }

  var hasil = DatabaseEngine.executeTransaction(DB_USERS, function(sheet) {

    // Cek apakah email sudah terdaftar
    var existing = DatabaseEngine.findRow(sheet, COL_USER.EMAIL, emailBaru);
    if (existing) {
      var statusAktif = existing.rowData[COL_USER.AKTIF];
      if (statusAktif === true || statusAktif === "TRUE") {
        throw new Error("Email '" + emailBaru + "' sudah terdaftar dan aktif di sistem.");
      }
      sheet.getRange(existing.rowIndex, COL_USER.ROLE + 1).setValue(roleBaru);
      sheet.getRange(existing.rowIndex, COL_USER.NAMA + 1).setValue(namaBaru);
      sheet.getRange(existing.rowIndex, COL_USER.AKTIF + 1).setValue(true);
      sheet.getRange(existing.rowIndex, COL_USER.DITAMBAH_AT + 1).setValue(new Date());
      sheet.getRange(existing.rowIndex, COL_USER.DITAMBAH_OLEH + 1).setValue(operatorEmail);
      sheet.getRange(existing.rowIndex, COL_USER.DICABUT_AT + 1).setValue("");
      sheet.getRange(existing.rowIndex, COL_USER.DICABUT_OLEH + 1).setValue("");
      sheet.getRange(existing.rowIndex, COL_USER.CATATAN + 1).setValue(catatan || "Reaktivasi");
    } else {
      sheet.appendRow([
        emailBaru,
        roleBaru,
        namaBaru,
        true,
        new Date(),
        operatorEmail,
        "",
        "",
        catatan || ""
      ]);
    }

    return { email: emailBaru, role: roleBaru, nama: namaBaru };
  });

  invalidateUserCache(emailBaru);

  writeAuditLog(
    ACTION_TYPES.AKSES_DITAMBAH,
    "Akses ditambahkan untuk '" + emailBaru + "' sebagai " + roleBaru +
    ". Oleh Operator: " + operatorEmail +
    ". Catatan: " + (catatan || "-")
  );

  return hasil;
}


// ─────────────────────────────────────────────
// 5. CABUT AKSES PENGGUNA
//
// Pencabutan akses paling lambat 1 hari kerja
// setelah perintah Atasan diterima.
// ─────────────────────────────────────────────

/**
 * Mencabut akses pengguna dari sistem.
 * Hanya bisa dieksekusi oleh Operator.
 * Data pengguna tidak dihapus — hanya ditandai tidak aktif (soft delete).
 *
 * @param {string} operatorEmail  - Email Operator yang mengeksekusi
 * @param {string} emailTarget    - Email pengguna yang dicabut aksesnya
 * @param {string} catatan        - Alasan pencabutan (contoh: "Mutasi per Juni 2026")
 * @returns {object}              - Konfirmasi pencabutan
 */
function cabutAksesUser(operatorEmail, emailTarget, catatan) {

  requireRole(operatorEmail, ROLES.OPERATOR);

  // Operator tidak bisa mencabut akses dirinya sendiri
  if (operatorEmail === emailTarget) {
    throw new Error(
      "Operator tidak dapat mencabut akses dirinya sendiri. " +
      "Hubungi Atasan untuk mengatur pergantian Operator."
    );
  }

  var hasil = DatabaseEngine.executeTransaction(DB_USERS, function(sheet) {
    var existing = DatabaseEngine.findRow(sheet, COL_USER.EMAIL, emailTarget);

    if (!existing) {
      throw new Error("Email '" + emailTarget + "' tidak ditemukan di sistem.");
    }

    var aktif = existing.rowData[COL_USER.AKTIF];
    if (aktif !== true && aktif !== "TRUE") {
      throw new Error("Akses '" + emailTarget + "' sudah dicabut sebelumnya.");
    }

    // Soft delete — tandai tidak aktif, catat tanggal & operator
    sheet.getRange(existing.rowIndex, COL_USER.AKTIF + 1).setValue(false);
    sheet.getRange(existing.rowIndex, COL_USER.DICABUT_AT + 1).setValue(new Date());
    sheet.getRange(existing.rowIndex, COL_USER.DICABUT_OLEH + 1).setValue(operatorEmail);
    sheet.getRange(existing.rowIndex, COL_USER.CATATAN + 1).setValue(catatan || "");

    return {
      email  : emailTarget,
      role   : existing.rowData[COL_USER.ROLE],
      status : "dicabut"
    };
  });

  invalidateUserCache(emailTarget);

  writeAuditLog(
    ACTION_TYPES.AKSES_DICABUT,
    "Akses dicabut untuk '" + emailTarget + "' (role: " + hasil.role + "). " +
    "Oleh Operator: " + operatorEmail +
    ". Catatan: " + (catatan || "-")
  );

  return hasil;
}


// ─────────────────────────────────────────────
// 6. HELPER: INVALIDASI CACHE
// ─────────────────────────────────────────────

/**
 * Menghapus cache role pengguna tertentu.
 * Dipanggil setelah tambah atau cabut akses
 * agar perubahan efektif segera tanpa tunggu TTL.
 *
 * @param {string} email - Email pengguna yang cache-nya dihapus
 */
function invalidateUserCache(email) {
  try {
    CacheService.getScriptCache().remove(CACHE_KEY_ROLE + email);
  } catch (e) {
    Logger.log("Cache invalidation failed untuk " + email + ": " + e.toString());
  }
}


// ─────────────────────────────────────────────
// 7. GET ACTIVE USER EMAIL
//
// Wrapper untuk Session.getActiveUser().getEmail()
// dengan fallback yang konsisten.
// ─────────────────────────────────────────────

/**
 * Mengambil email pengguna aktif dari Google session.
 * Throw error jika email tidak tersedia — sistem tidak boleh
 * jalan tanpa identitas pengguna yang jelas.
 *
 * @returns {string} - Email pengguna aktif
 */
function getActiveUserEmail() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error(
      "Gagal mengidentifikasi pengguna aktif. " +
      "Pastikan kamu login dengan akun Google yang terdaftar di sistem."
    );
  }
  return email;
}


// ─────────────────────────────────────────────
// 8. GET SEMUA USER AKTIF
//
// Untuk kebutuhan UI — menampilkan daftar
// Anggota Tim saat Atasan assign penanggung jawab.
// ─────────────────────────────────────────────

/**
 * Mengambil semua pengguna aktif, dikelompokkan per role.
 * Hanya bisa diakses oleh Operator dan Atasan.
 *
 * @param {string} requesterEmail - Email pengguna yang request data ini
 * @returns {object}              - { atasan: [], operator: [], anggotaTim: [] }
 */
function getAllActiveUsers(requesterEmail) {
  requireRole(requesterEmail, [ROLES.OPERATOR, ROLES.ATASAN]);

  var sheet  = DatabaseEngine.getSheet(DB_USERS);
  var data   = sheet.getDataRange().getValues();
  var result = { atasan: [], operator: [], anggotaTim: [] };

  for (var i = 1; i < data.length; i++) {
    var row   = data[i];
    var aktif = row[COL_USER.AKTIF];
    if (aktif !== true && aktif !== "TRUE") continue;

    var user = {
      email : row[COL_USER.EMAIL],
      nama  : row[COL_USER.NAMA],
      role  : row[COL_USER.ROLE]
    };

    if (user.role === ROLES.ATASAN)      result.atasan.push(user);
    if (user.role === ROLES.OPERATOR)    result.operator.push(user);
    if (user.role === ROLES.ANGGOTA_TIM) result.anggotaTim.push(user);
  }

  return result;
}
