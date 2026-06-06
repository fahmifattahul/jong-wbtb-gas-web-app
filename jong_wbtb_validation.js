/**
 * JONG WBTb — Modul Server-Side File Validation
 *
 * BATAS UKURAN FILE:
 * - PDF (kajian, sertifikat)  : 15MB per file
 * - Foto (JPG/PNG)            : 5MB per file
 * - File .txt URL video       : 10KB per file
 * - Total per request         : 30MB aggregate (sebelum Base64 inflate)
 *
 * CATATAN DEVELOPER:
 * - Validasi ini adalah mirror dari validasi frontend.
 *   Frontend validasi untuk UX — server validasi untuk keamanan.
 *   Jangan hapus salah satu.
 * - Semua fungsi menerima payload Base64 dan metadata dari client.
 * - Base64 inflate ~33% — batas di sini dalam bytes SEBELUM Base64.
 *   Konversi dari Base64 length: bytes = base64Length * 0.75
 */


// ─────────────────────────────────────────────
// 1. KONSTANTA BATAS UKURAN
// ─────────────────────────────────────────────

var FILE_LIMITS = {
  PDF_BYTES    : 15 * 1024 * 1024,
  FOTO_BYTES   : 5  * 1024 * 1024,
  TXT_BYTES    : 10 * 1024,
  TOTAL_BYTES  : 30 * 1024 * 1024
};

var MIME_IZIN = {
  PDF  : ["application/pdf"],
  FOTO : ["image/jpeg", "image/png"],
  TXT  : ["text/plain"]
};


// ─────────────────────────────────────────────
// 2. HELPER: HITUNG UKURAN DARI BASE64
// ─────────────────────────────────────────────

/**
 * Menghitung ukuran file asli (bytes) dari panjang string Base64.
 * Formula: bytes ≈ base64Length * 0.75
 * (Base64 encode 3 bytes menjadi 4 karakter)
 *
 * @param {string} base64String - String Base64 (dengan atau tanpa data URI prefix)
 * @returns {number}            - Estimasi ukuran file dalam bytes
 */
function hitungUkuranDariBase64(base64String) {
  var base64Data = base64String.indexOf(",") !== -1
    ? base64String.split(",")[1]
    : base64String;

  var padding = 0;
  if (base64Data.charAt(base64Data.length - 1) === "=") padding++;
  if (base64Data.charAt(base64Data.length - 2) === "=") padding++;

  return Math.floor((base64Data.length * 3) / 4) - padding;
}


// ─────────────────────────────────────────────
// 3. VALIDASI PER JENIS FILE
// ─────────────────────────────────────────────

/**
 * Memvalidasi satu file PDF (kajian ilmiah atau sertifikat).
 *
 * @param {object} fileMeta - Metadata file dari client:
 *                            { name, mimeType, base64, sizeBytes }
 * @returns {{ valid: boolean, pesan: string }}
 */
function validateFilePDF(fileMeta) {
  if (!fileMeta || !fileMeta.base64) {
    return { valid: false, pesan: "Data file tidak lengkap." };
  }

  if (MIME_IZIN.PDF.indexOf(fileMeta.mimeType) === -1) {
    return {
      valid: false,
      pesan: "Format file tidak valid. Hanya PDF yang diizinkan. " +
             "File diterima: " + fileMeta.mimeType
    };
  }

  var ukuranBytes = hitungUkuranDariBase64(fileMeta.base64);
  if (ukuranBytes > FILE_LIMITS.PDF_BYTES) {
    return {
      valid: false,
      pesan: "Ukuran file '" + fileMeta.name + "' melebihi batas maksimal 15MB. " +
             "Ukuran terdeteksi: " + Math.round(ukuranBytes / (1024 * 1024)) + "MB."
    };
  }


  return { valid: true, pesan: "File PDF valid.", ukuranBytes: ukuranBytes };
}


/**
 * Memvalidasi satu file foto (JPG atau PNG).
 *
 * @param {object} fileMeta - Metadata file dari client:
 *                            { name, mimeType, base64, sizeBytes }
 * @returns {{ valid: boolean, pesan: string }}
 */
function validateFileFoto(fileMeta) {
  if (!fileMeta || !fileMeta.base64) {
    return { valid: false, pesan: "Data file tidak lengkap." };
  }

  if (MIME_IZIN.FOTO.indexOf(fileMeta.mimeType) === -1) {
    return {
      valid: false,
      pesan: "Format file tidak valid. Hanya JPG dan PNG yang diizinkan. " +
             "File diterima: " + fileMeta.mimeType
    };
  }

  var ukuranBytes = hitungUkuranDariBase64(fileMeta.base64);
  if (ukuranBytes > FILE_LIMITS.FOTO_BYTES) {
    return {
      valid: false,
      pesan: "Ukuran foto '" + fileMeta.name + "' melebihi batas maksimal 5MB. " +
             "Ukuran terdeteksi: " + Math.round(ukuranBytes / (1024 * 1024) * 100) / 100 + "MB. " +
             "Kompres foto sebelum upload."
    };
  }


  return { valid: true, pesan: "File foto valid.", ukuranBytes: ukuranBytes };
}


/**
 * Memvalidasi URL video eksternal.
 * Video tidak diunggah langsung — hanya URL yang disimpan di file .txt.
 * Juknis Bab IV huruf C.
 *
 * @param {string} url - URL video dari user
 * @returns {{ valid: boolean, pesan: string }}
 */
function validateVideoUrl(url) {
  if (!url || typeof url !== "string") {
    return { valid: false, pesan: "URL video tidak boleh kosong." };
  }

  var trimmed = url.trim();

  if (!trimmed.startsWith("https://")) {
    return {
      valid: false,
      pesan: "URL video harus menggunakan HTTPS. " +
             "Contoh: https://youtube.com/watch?v=xxx atau https://drive.google.com/..."
    };
  }

  // Harus dari platform yang diizinkan Atasan
  // Per Juknis Bab IV huruf C: platform ditetapkan Atasan.
  var platformIzin = [
    "youtube.com",
    "youtu.be",
    "drive.google.com"
  ];

  var urlMatch = platformIzin.some(function(platform) {
    return trimmed.indexOf(platform) !== -1;
  });

  if (!urlMatch) {
    return {
      valid: false,
      pesan: "Platform video tidak diizinkan. " +
             "Gunakan YouTube atau Google Drive Publik. " +
             "Platform lain harus mendapat persetujuan Atasan terlebih dahulu."
    };
  }

  if (trimmed.length > 500) {
    return { valid: false, pesan: "URL video terlalu panjang (maksimal 500 karakter)." };
  }

  return { valid: true, pesan: "URL video valid." };
}


// ─────────────────────────────────────────────
// 4. VALIDASI AGGREGATE (TOTAL PER REQUEST)
// ─────────────────────────────────────────────

/**
 * Memvalidasi total ukuran semua file dalam satu request.
 * Mencegah payload melebihi batas GAS 50MB setelah Base64 inflate.
 *
 * @param {Array} fileMetaArray - Array metadata file ({ base64, name, mimeType })
 * @returns {{ valid: boolean, pesan: string, totalBytes: number }}
 */
function validateTotalPayload(fileMetaArray) {
  if (!fileMetaArray || fileMetaArray.length === 0) {
    return { valid: true, pesan: "Tidak ada file.", totalBytes: 0 };
  }

  var totalBytes = 0;
  for (var i = 0; i < fileMetaArray.length; i++) {
    if (fileMetaArray[i].base64) {
      totalBytes += hitungUkuranDariBase64(fileMetaArray[i].base64);
    }
  }

  if (totalBytes > FILE_LIMITS.TOTAL_BYTES) {
    return {
      valid: false,
      pesan: "Total ukuran semua file (" + Math.round(totalBytes / (1024 * 1024)) + "MB) " +
             "melebihi batas maksimal 30MB per request. " +
             "Upload file secara bertahap.",
      totalBytes: totalBytes
    };
  }

  return { valid: true, pesan: "Total payload valid.", totalBytes: totalBytes };
}


// ─────────────────────────────────────────────
// 5. VALIDASI VERIFIKASI MANDIRI
//
// Juknis Bab V huruf B: sebelum Anggota Tim
// menyampaikan Folder Usulan ke Atasan, seluruh
// item verifikasi mandiri harus terpenuhi.
// Folder yang tidak memenuhi dikembalikan tanpa ditinjau.
// ─────────────────────────────────────────────

/**
 * Menjalankan seluruh cek verifikasi mandiri sebelum
 * tombol "Kirim ke Atasan" boleh aktif.
 *
 * @param {string} proposalId - ID usulan yang akan dikirim ke Atasan
 * @returns {{ siap: boolean, itemGagal: string[], itemLulus: string[] }}
 */
function verifikasiMandiri(proposalId) {
  var sheet  = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
  var hasil  = DatabaseEngine.findRow(sheet, COL.ID, proposalId);

  if (!hasil) {
    throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan.");
  }

  var row         = hasil.rowData;
  var itemGagal   = [];
  var itemLulus   = [];

  function cek(kondisi, labelLulus, labelGagal) {
    if (kondisi) {
      itemLulus.push(labelLulus);
    } else {
      itemGagal.push(labelGagal);
    }
  }

  // ── Cek 1: Nama folder dan file sesuai standar penamaan ──
  // Tidak bisa dicek otomatis di server tanpa list semua file Drive.
  // Ini responsibility Anggota Tim — dikonfirmasi via checkbox di UI.
  var judulSingkat = row[COL.JUDUL_SINGKAT] || "";
  var validasiJudul = validateJudulSingkat(judulSingkat);
  cek(
    validasiJudul.valid,
    "Judul singkat terdaftar dan valid (" + judulSingkat + ")",
    "Judul singkat belum diisi atau tidak valid. Hubungi Operator."
  );

  // ── Cek 2: Formulir usulan sudah diisi ──
  var docActiveId = row[COL.DOC_ACTIVE_ID] || "";
  cek(
    docActiveId !== "",
    "Formulir usulan tersedia (Doc ID: " + docActiveId + ")",
    "Formulir usulan belum dibuat atau belum terhubung ke sistem."
  );

  // ── Cek 3: Minimal 1 file kajian ilmiah terunggah ──
  var kajianFiles = [];
  try { kajianFiles = JSON.parse(row[COL.KAJIAN_FILES_JSON] || "[]"); } catch(e) {}
  var kajianAktif = kajianFiles.filter(function(f) { return f.status === "aktif"; });
  cek(
    kajianAktif.length > 0,
    "Kajian ilmiah tersedia (" + kajianAktif.length + " file aktif)",
    "Kajian ilmiah belum diunggah. Minimal 1 file kajian wajib ada."
  );

  // ── Cek 4: Minimal 1 foto dokumentasi terunggah ──
  var fotoFiles = [];
  try { fotoFiles = JSON.parse(row[COL.FOTO_FILES_JSON] || "[]"); } catch(e) {}
  var fotoAktif = fotoFiles.filter(function(f) { return f.status === "aktif"; });
  cek(
    fotoAktif.length > 0,
    "Foto dokumentasi tersedia (" + fotoAktif.length + " foto aktif)",
    "Foto dokumentasi belum diunggah. Minimal 1 foto wajib ada."
  );

  // ── Cek 5: Video dokumentasi tersedia ──
  var videoUrl = row[COL.VIDEO_URL] || "";
  cek(
    videoUrl !== "",
    "URL video dokumentasi tersedia",
    "URL video dokumentasi belum diisi."
  );

  // ── Cek 6: Dokumen berada di subfolder tahap yang sesuai ──
  // Dikonfirmasi secara implisit dari status folder — jika status SEDANG_DIKERJAKAN,
  // dokumen aktif ada di subfolder 01_PENGUMPULAN-DATA (entry pertama).
  var status = row[COL.STATUS] || "";
  cek(
    status === STATUS.SEDANG_DIKERJAKAN,
    "Status folder sesuai (Sedang Dikerjakan)",
    "Status folder tidak sesuai untuk pengiriman ke Atasan. Status saat ini: " + status
  );

  // ── Cek 7: Versi dokumen adalah yang terbaru ──
  // Dikonfirmasi dari doc_history_json — versi tertinggi harus sama dengan doc_active_id
  var docHistory = {};
  try { docHistory = JSON.parse(row[COL.DOC_HISTORY_JSON] || "{}"); } catch(e) {}
  var versiKeys = Object.keys(docHistory);
  var versiTertinggi = versiKeys.length > 0
    ? docHistory[versiKeys[versiKeys.length - 1]]
    : null;
  cek(
    versiTertinggi === docActiveId,
    "Formulir adalah versi terbaru",
    "Formulir aktif bukan versi terbaru. Periksa doc_history di sistem."
  );

  // ── Cek 8: Versi lama sudah dipindah ke ARSIP-VERSI ──
  // Dikonfirmasi dari metadata — semua item di kajian & foto selain yang aktif harus berstatus "diarsip"
  var kajianTidakDiarsip = kajianFiles.filter(function(f) {
    return f.status !== "aktif" && f.status !== "diarsip";
  });
  var fotoTidakDiarsip = fotoFiles.filter(function(f) {
    return f.status !== "aktif" && f.status !== "diarsip";
  });
  cek(
    kajianTidakDiarsip.length === 0 && fotoTidakDiarsip.length === 0,
    "Seluruh versi lama sudah diarsipkan dengan benar",
    "Ada file dengan status tidak valid (bukan 'aktif' atau 'diarsip'). " +
    "Periksa metadata kajian dan foto."
  );

  // ── Cek 9: Tabel riwayat versi pada formulir sudah diperbarui ──
  // Tidak bisa dicek otomatis dari GAS tanpa buka Google Docs.
  // Dikonfirmasi via checkbox di UI oleh Anggota Tim.
  cek(
    versiKeys.length > 0,
    "Riwayat versi formulir tercatat (" + versiKeys.length + " versi)",
    "Riwayat versi formulir kosong. Pastikan formulir sudah dibuat via sistem."
  );

  // ── Cek 10 (kondisional): Catatan Penilai Eksternal sudah ditangani ──
  // Hanya relevan jika ada putaran revisi aktif.
  var revisiRound = parseInt(row[COL.REVISI_ROUND] || "0", 10);
  if (revisiRound > 0) {
    var catatanPenilai = [];
    try { catatanPenilai = JSON.parse(row[COL.CATATAN_PENILAI_JSON] || "[]"); } catch(e) {}
    var putaranAktif = catatanPenilai.find(function(c) {
      return c.putaran === revisiRound;
    });
    cek(
      putaranAktif && putaranAktif.fileId,
      "Catatan Penilai Eksternal P" + String(revisiRound).padStart(2, "0") + " terdokumentasi",
      "Catatan Penilai Eksternal untuk putaran " + revisiRound + " belum terdokumentasi."
    );
  }

  return {
    siap       : itemGagal.length === 0,
    itemGagal  : itemGagal,
    itemLulus  : itemLulus
  };
}

/**
 * Memvalidasi file presentasi (PPT/PPTX/PDF).
 *
 * @param {object} fileMeta - { name, mimeType, base64 }
 * @returns {{ valid: boolean, pesan: string, ukuranBytes: number }}
 */
function validateFilePresentasi(fileMeta) {
  if (!fileMeta || !fileMeta.base64) {
    return { valid: false, pesan: "Data file tidak lengkap." };
  }

  var mimeIzin = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ];

  if (mimeIzin.indexOf(fileMeta.mimeType) === -1) {
    return {
      valid: false,
      pesan: "Format file tidak valid. Hanya PDF, PPT, atau PPTX yang diizinkan."
    };
  }

  var ukuranBytes = hitungUkuranDariBase64(fileMeta.base64);
  if (ukuranBytes > 20 * 1024 * 1024) {
    return {
      valid: false,
      pesan: "Ukuran file presentasi '" + fileMeta.name + "' melebihi batas maksimal 20MB. " +
             "Ukuran terdeteksi: " + Math.round(ukuranBytes / (1024 * 1024)) + "MB."
    };
  }

  return { valid: true, pesan: "File presentasi valid.", ukuranBytes: ukuranBytes };
}
