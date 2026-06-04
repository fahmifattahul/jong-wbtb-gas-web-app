/**
 * JONG WBTb — Modul Naming Convention File
 * Sesuai Juknis Tata Kelola Dokumen Digital WBTb 2026 Revisi 2
 * Bab III huruf C
 *
 * ATURAN DASAR (Juknis Bab III huruf C):
 * - Seluruh nama folder dan file menggunakan HURUF KAPITAL
 * - Spasi dilarang
 * - Tanda hubung (-) = pemisah antar kata dalam satu segmen
 * - Garis bawah (_) = pemisah antar segmen utama
 *
 * FORMAT PER JENIS DOKUMEN:
 * ┌─────────────────────────────┬────────────────────────────────────────┬──────────────────────────────────────┐
 * │ Jenis                       │ Format                                 │ Contoh                               │
 * ├─────────────────────────────┼────────────────────────────────────────┼──────────────────────────────────────┤
 * │ Formulir (luar Revisi)      │ FORM_[JUDUL-SINGKAT]_v[N]              │ FORM_TEPUNG-TAWAR_v1                 │
 * │ Formulir (dalam Revisi)     │ FORM_[JUDUL-SINGKAT]_P[XX]_v[N]       │ FORM_TEPUNG-TAWAR_P01_v2             │
 * │ Kajian ilmiah               │ KAJIAN_[JUDUL-SINGKAT]_[NNN]          │ KAJIAN_TEPUNG-TAWAR_001              │
 * │ Kajian (dalam Revisi)       │ KAJIAN_[JUDUL-SINGKAT]_P[XX]_[NNN]   │ KAJIAN_TEPUNG-TAWAR_P01_001          │
 * │ Foto dokumentasi            │ FOTO_[JUDUL-SINGKAT]_[NNN]            │ FOTO_TEPUNG-TAWAR_001                │
 * │ Video (file .txt URL)       │ VID_[JUDUL-SINGKAT]_[NNN]             │ VID_TEPUNG-TAWAR_001                 │
 * │ Catatan Penilai Eksternal   │ CATATAN-PENILAI_P[XX]                 │ CATATAN-PENILAI_P01                  │
 * │ Presentasi                  │ PRESENTASI_[JUDUL-SINGKAT]_v[N]       │ PRESENTASI_TEPUNG-TAWAR_v1           │
 * │ Sertifikat/SK Penetapan     │ SERTIFIKAT_[JUDUL-SINGKAT]_[TAHUN]    │ SERTIFIKAT_TEPUNG-TAWAR_2026         │
 * │ Publikasi                   │ PUBLIKASI_[JUDUL-SINGKAT]_[TAHUN]     │ PUBLIKASI_TEPUNG-TAWAR_2026          │
 * └─────────────────────────────┴────────────────────────────────────────┴──────────────────────────────────────┘
 *
 * KODE:
 * [N]   = nomor versi, mulai dari 1 (tanpa padding)
 * [XX]  = nomor putaran revisi, 2 digit, zero-padded (01, 02, ...)
 * [NNN] = nomor urut file, 3 digit, zero-padded (001, 002, ...)
 * [TAHUN] = tahun 4 digit (2026)
 *
 * SCHEMA UPDATE:
 * Tambahkan kolom berikut ke db_wbtb_lingga di jong_wbtb_database.js:
 * JUDUL_SINGKAT : 22  // String | Input user saat buat usulan. UPPERCASE, hanya A-Z dan tanda hubung.
 * Dan update TOTAL_COLS_WBTB dari 22 menjadi 23.
 * Dan tambahkan "judul_singkat" ke HEADERS_WBTB.
 *
 * CATATAN DEVELOPER:
 * - Jangan pernah generate nama file tanpa lewat fungsi di modul ini.
 * - Semua fungsi di sini pure functions — tidak ada side effect ke Drive atau Sheet.
 * - Validasi judul_singkat harus dilakukan di frontend sebelum submit,
 *   dan di server (validateJudulSingkat) sebelum disimpan.
 */


// ─────────────────────────────────────────────
// 1. VALIDASI JUDUL SINGKAT
//
// Diinput user sekali saat buat usulan baru.
// Dipakai untuk semua penamaan file sepanjang
// lifecycle Folder Usulan.
// ─────────────────────────────────────────────

/**
 * Memvalidasi format judul singkat yang diinput user.
 * Format valid: UPPERCASE, hanya A-Z dan tanda hubung (-), tanpa spasi.
 * Minimal 2 karakter, maksimal 30 karakter.
 *
 * @param {string} judulSingkat - Input judul singkat dari user
 * @returns {{ valid: boolean, pesan: string }} - Hasil validasi
 */
function validateJudulSingkat(judulSingkat) {
  if (!judulSingkat || typeof judulSingkat !== "string") {
    return { valid: false, pesan: "Judul singkat tidak boleh kosong." };
  }

  var trimmed = judulSingkat.trim();

  if (trimmed.length < 2) {
    return { valid: false, pesan: "Judul singkat minimal 2 karakter." };
  }

  if (trimmed.length > 30) {
    return { valid: false, pesan: "Judul singkat maksimal 30 karakter." };
  }

  // Hanya A-Z (uppercase) dan tanda hubung, tidak boleh mulai/akhiri dengan tanda hubung
  var polaNama = /^[A-Z][A-Z0-9-]*[A-Z0-9]$|^[A-Z]$/;
  if (!polaNama.test(trimmed)) {
    return {
      valid: false,
      pesan: "Judul singkat harus UPPERCASE, hanya huruf A-Z, angka, dan tanda hubung (-). " +
             "Tidak boleh ada spasi, underscore, atau karakter lain. " +
             "Contoh valid: TEPUNG-TAWAR, JOGET-DANGKONG, TARI-INAI"
    };
  }

  // Tidak boleh ada tanda hubung berurutan
  if (/--/.test(trimmed)) {
    return { valid: false, pesan: "Tanda hubung tidak boleh berurutan (--). Contoh valid: TEPUNG-TAWAR" };
  }

  return { valid: true, pesan: "Judul singkat valid." };
}


// ─────────────────────────────────────────────
// 2. HELPER FORMAT KODE
// ─────────────────────────────────────────────

/**
 * Format nomor putaran revisi — 2 digit zero-padded.
 * Contoh: 1 → "P01", 12 → "P12"
 * @param {number} putaran
 * @returns {string}
 */
function formatKodePutaran(putaran) {
  return "P" + String(putaran).padStart(2, "0");
}

/**
 * Format nomor urut file — 3 digit zero-padded.
 * Contoh: 1 → "001", 12 → "012"
 * @param {number} nomor
 * @returns {string}
 */
function formatNomorUrut(nomor) {
  return String(nomor).padStart(3, "0");
}

/**
 * Format nomor versi — tanpa padding.
 * Contoh: 1 → "v1", 12 → "v12"
 * @param {number} versi
 * @returns {string}
 */
function formatVersi(versi) {
  return "v" + String(versi);
}


// ─────────────────────────────────────────────
// 3. GENERATOR NAMA FILE
//
// Satu fungsi per jenis dokumen.
// Semua pure functions — tidak ada I/O.
// ─────────────────────────────────────────────

/**
 * Nama file formulir usulan di luar tahap Revisi.
 * Format: FORM_[JUDUL-SINGKAT]_v[N]
 *
 * @param {string} judulSingkat - Judul singkat karya (contoh: "TEPUNG-TAWAR")
 * @param {number} versi        - Nomor versi (contoh: 1)
 * @returns {string}            - Contoh: "FORM_TEPUNG-TAWAR_v1"
 */
function namaFormulir(judulSingkat, versi) {
  return "FORM_" + judulSingkat + "_" + formatVersi(versi);
}

/**
 * Nama file formulir usulan di dalam tahap Revisi.
 * Format: FORM_[JUDUL-SINGKAT]_P[XX]_v[N]
 *
 * @param {string} judulSingkat - Judul singkat karya
 * @param {number} putaran      - Nomor putaran revisi
 * @param {number} versi        - Nomor versi
 * @returns {string}            - Contoh: "FORM_TEPUNG-TAWAR_P01_v2"
 */
function namaFormulirRevisi(judulSingkat, putaran, versi) {
  return "FORM_" + judulSingkat + "_" + formatKodePutaran(putaran) + "_" + formatVersi(versi);
}

/**
 * Nama file kajian ilmiah di luar tahap Revisi.
 * Format: KAJIAN_[JUDUL-SINGKAT]_[NNN]
 *
 * @param {string} judulSingkat - Judul singkat karya
 * @param {number} nomorUrut    - Nomor urut file kajian
 * @returns {string}            - Contoh: "KAJIAN_TEPUNG-TAWAR_001"
 */
function namaKajian(judulSingkat, nomorUrut) {
  return "KAJIAN_" + judulSingkat + "_" + formatNomorUrut(nomorUrut);
}

/**
 * Nama file kajian ilmiah di dalam tahap Revisi.
 * Format: KAJIAN_[JUDUL-SINGKAT]_P[XX]_[NNN]
 *
 * @param {string} judulSingkat - Judul singkat karya
 * @param {number} putaran      - Nomor putaran revisi
 * @param {number} nomorUrut    - Nomor urut file kajian
 * @returns {string}            - Contoh: "KAJIAN_TEPUNG-TAWAR_P01_001"
 */
function namaKajianRevisi(judulSingkat, putaran, nomorUrut) {
  return "KAJIAN_" + judulSingkat + "_" + formatKodePutaran(putaran) + "_" + formatNomorUrut(nomorUrut);
}

/**
 * Nama file foto dokumentasi.
 * Format: FOTO_[JUDUL-SINGKAT]_[NNN]
 *
 * @param {string} judulSingkat - Judul singkat karya
 * @param {number} nomorUrut    - Nomor urut foto
 * @returns {string}            - Contoh: "FOTO_TEPUNG-TAWAR_001"
 */
function namaFoto(judulSingkat, nomorUrut) {
  return "FOTO_" + judulSingkat + "_" + formatNomorUrut(nomorUrut);
}

/**
 * Nama file .txt URL video dokumentasi.
 * Format: VID_[JUDUL-SINGKAT]_[NNN].txt
 *
 * @param {string} judulSingkat - Judul singkat karya
 * @param {number} nomorUrut    - Nomor urut video
 * @returns {string}            - Contoh: "VID_TEPUNG-TAWAR_001.txt"
 */
function namaVideoTxt(judulSingkat, nomorUrut) {
  return "VID_" + judulSingkat + "_" + formatNomorUrut(nomorUrut) + ".txt";
}

/**
 * Nama file Catatan Penilai Eksternal.
 * Format: CATATAN-PENILAI_P[XX]
 * Tidak ada ekstensi — nama folder atau file PDF sesuai format asli dari penilai.
 *
 * @param {number} putaran - Nomor putaran revisi
 * @returns {string}       - Contoh: "CATATAN-PENILAI_P01"
 */
function namaCatatanPenilai(putaran) {
  return "CATATAN-PENILAI_" + formatKodePutaran(putaran);
}

/**
 * Nama file presentasi.
 * Format: PRESENTASI_[JUDUL-SINGKAT]_v[N]
 *
 * @param {string} judulSingkat - Judul singkat karya
 * @param {number} versi        - Nomor versi
 * @returns {string}            - Contoh: "PRESENTASI_TEPUNG-TAWAR_v1"
 */
function namaPresentasi(judulSingkat, versi) {
  return "PRESENTASI_" + judulSingkat + "_" + formatVersi(versi);
}

/**
 * Nama file sertifikat/SK penetapan nasional.
 * Format: SERTIFIKAT_[JUDUL-SINGKAT]_[TAHUN]
 *
 * @param {string} judulSingkat - Judul singkat karya
 * @param {number} tahun        - Tahun penetapan (contoh: 2026)
 * @returns {string}            - Contoh: "SERTIFIKAT_TEPUNG-TAWAR_2026"
 */
function namaSertifikat(judulSingkat, tahun) {
  return "SERTIFIKAT_" + judulSingkat + "_" + String(tahun);
}

/**
 * Nama file publikasi.
 * Format: PUBLIKASI_[JUDUL-SINGKAT]_[TAHUN]
 *
 * @param {string} judulSingkat - Judul singkat karya
 * @param {number} tahun        - Tahun publikasi
 * @returns {string}            - Contoh: "PUBLIKASI_TEPUNG-TAWAR_2026"
 */
function namaPublikasi(judulSingkat, tahun) {
  return "PUBLIKASI_" + judulSingkat + "_" + String(tahun);
}


// ─────────────────────────────────────────────
// 4. ROUTER NAMA FILE
//
// Satu fungsi terpadu yang memilih generator
// yang tepat berdasarkan jenis dokumen dan
// konteks (dalam revisi atau tidak).
// ─────────────────────────────────────────────

/**
 * Kode jenis dokumen untuk dipakai di namaFile().
 */
var JENIS_DOK = {
  FORMULIR          : "formulir",
  FORMULIR_REVISI   : "formulir_revisi",
  KAJIAN            : "kajian",
  KAJIAN_REVISI     : "kajian_revisi",
  FOTO              : "foto",
  VIDEO_TXT         : "video_txt",
  CATATAN_PENILAI   : "catatan_penilai",
  PRESENTASI        : "presentasi",
  SERTIFIKAT        : "sertifikat",
  PUBLIKASI         : "publikasi"
};

/**
 * Router terpadu untuk generate nama file.
 * Gunakan fungsi ini di seluruh sistem — jangan panggil generator individual langsung.
 *
 * @param {string} jenisDok     - Kode jenis dokumen (dari JENIS_DOK)
 * @param {string} judulSingkat - Judul singkat karya
 * @param {object} params       - Parameter tambahan sesuai jenis:
 *                                { versi, putaran, nomorUrut, tahun }
 * @returns {string}            - Nama file yang sudah diformat
 */
function namaFile(jenisDok, judulSingkat, params) {
  var p = params || {};

  // Validasi judulSingkat setiap kali generate nama file
  var validasi = validateJudulSingkat(judulSingkat);
  if (!validasi.valid) {
    throw new Error("Judul singkat tidak valid: " + validasi.pesan);
  }

  switch (jenisDok) {
    case JENIS_DOK.FORMULIR:
      if (!p.versi) throw new Error("namaFile FORMULIR butuh params.versi");
      return namaFormulir(judulSingkat, p.versi);

    case JENIS_DOK.FORMULIR_REVISI:
      if (!p.putaran || !p.versi) throw new Error("namaFile FORMULIR_REVISI butuh params.putaran dan params.versi");
      return namaFormulirRevisi(judulSingkat, p.putaran, p.versi);

    case JENIS_DOK.KAJIAN:
      if (!p.nomorUrut) throw new Error("namaFile KAJIAN butuh params.nomorUrut");
      return namaKajian(judulSingkat, p.nomorUrut);

    case JENIS_DOK.KAJIAN_REVISI:
      if (!p.putaran || !p.nomorUrut) throw new Error("namaFile KAJIAN_REVISI butuh params.putaran dan params.nomorUrut");
      return namaKajianRevisi(judulSingkat, p.putaran, p.nomorUrut);

    case JENIS_DOK.FOTO:
      if (!p.nomorUrut) throw new Error("namaFile FOTO butuh params.nomorUrut");
      return namaFoto(judulSingkat, p.nomorUrut);

    case JENIS_DOK.VIDEO_TXT:
      if (!p.nomorUrut) throw new Error("namaFile VIDEO_TXT butuh params.nomorUrut");
      return namaVideoTxt(judulSingkat, p.nomorUrut);

    case JENIS_DOK.CATATAN_PENILAI:
      if (!p.putaran) throw new Error("namaFile CATATAN_PENILAI butuh params.putaran");
      return namaCatatanPenilai(p.putaran);

    case JENIS_DOK.PRESENTASI:
      if (!p.versi) throw new Error("namaFile PRESENTASI butuh params.versi");
      return namaPresentasi(judulSingkat, p.versi);

    case JENIS_DOK.SERTIFIKAT:
      if (!p.tahun) throw new Error("namaFile SERTIFIKAT butuh params.tahun");
      return namaSertifikat(judulSingkat, p.tahun);

    case JENIS_DOK.PUBLIKASI:
      if (!p.tahun) throw new Error("namaFile PUBLIKASI butuh params.tahun");
      return namaPublikasi(judulSingkat, p.tahun);

    default:
      throw new Error("Jenis dokumen '" + jenisDok + "' tidak dikenal. Gunakan konstanta JENIS_DOK.");
  }
}
