/**
 * JONG WBTb — State Machine Constants & Transition Matrix
 * Sesuai Juknis Tata Kelola Dokumen Digital WBTb 2026 Revisi 2
 * Bab VIII huruf D & E
 *
 * CATATAN DEVELOPER:
 * - Jangan pernah hardcode string status di tempat lain.
 *   Selalu gunakan konstanta STATUS di bawah ini.
 * - Perubahan status HANYA boleh dieksekusi via fungsi changeStatus().
 * - Putaran revisi (P01, P02, ...) disimpan di kolom terpisah `revisi_round`,
 *   BUKAN digabung ke dalam string status.
 */


// ─────────────────────────────────────────────
// 1. KONSTANTA STATUS
// ─────────────────────────────────────────────

var STATUS = {
  SEDANG_DIKERJAKAN   : "Sedang Dikerjakan",
  PERSETUJUAN_INTERNAL: "Persetujuan Internal",
  DIPERBAIKI          : "Diperbaiki",
  DILANJUTKAN         : "Dilanjutkan",
  DITANGGUHKAN        : "Ditangguhkan",
  FINAL               : "Final"
};

var ENTRY_TYPE = {
  NORMAL   : "normal",
  HISTORIS : "historis"
};


// ─────────────────────────────────────────────
// 2. KONSTANTA PERAN PENGGUNA
// Sesuai Juknis Bab VII huruf A
// ─────────────────────────────────────────────

var ROLES = {
  ANGGOTA_TIM: "Anggota Tim",
  OPERATOR   : "Operator",
  ATASAN     : "Atasan"
};


// ─────────────────────────────────────────────
// 3. TRANSITION MATRIX
//
//
// Referensi Juknis: Bab VIII huruf D & E, Bab VI huruf D, Bab IX huruf B
// ─────────────────────────────────────────────

var TRANSITIONS = [

  // ── ENTRY POINT 1: Usulan baru (normal flow) ──────────────────────────────
  {
    dari      : null,
    ke        : STATUS.SEDANG_DIKERJAKAN,
    aktor     : ROLES.OPERATOR,
    syarat    : "Folder baru pertama kali dibuat oleh Operator.",
    entry_type: ENTRY_TYPE.NORMAL
  },

  // ── ENTRY POINT 2: Import arsip historis ─────────────────────────────────
  // Juknis Bab IX huruf B: WBTb yang telah ditetapkan sebelum berlakunya
  // Juknis dicatat dalam Arsip Historis. Sertifikat penetapan wajib ada.
  {
    dari      : null,
    ke        : STATUS.FINAL,
    aktor     : ROLES.OPERATOR,
    syarat    : "Dokumen penetapan resmi (sertifikat) dari Kementerian tersedia. " +
                "Formulir, kajian, dan multimedia bersifat opsional untuk import historis.",
    entry_type: ENTRY_TYPE.HISTORIS
  },

  // ── NORMAL FLOW ───────────────────────────────────────────────────────────

  // ── NORMAL FLOW ───────────────────────────────────────────────────────────

  // Sedang Dikerjakan → Persetujuan Internal (oleh Anggota Tim - Kirim ke Atasan)
  {
    dari  : STATUS.SEDANG_DIKERJAKAN,
    ke    : STATUS.PERSETUJUAN_INTERNAL,
    aktor : ROLES.ANGGOTA_TIM,
    syarat: "Anggota Tim menyelesaikan penyusunan berkas usulan dan mengirimkannya ke Atasan untuk diverifikasi."
  },

  // Sedang Dikerjakan → Persetujuan Internal (oleh Operator - Kirim ke Atasan)
  {
    dari  : STATUS.SEDANG_DIKERJAKAN,
    ke    : STATUS.PERSETUJUAN_INTERNAL,
    aktor : ROLES.OPERATOR,
    syarat: "Operator menyelesaikan penyusunan berkas usulan dan mengirimkannya ke Atasan untuk diverifikasi."
  },

  // Sedang Dikerjakan → Persetujuan Internal (oleh Atasan - Setujui Awal)
  {
    dari  : STATUS.SEDANG_DIKERJAKAN,
    ke    : STATUS.PERSETUJUAN_INTERNAL,
    aktor : ROLES.ATASAN,
    syarat: "Atasan meninjau seluruh dokumen dalam Folder Usulan dan menyatakan layak."
  },

  // Persetujuan Internal → Persetujuan Internal (oleh Atasan - Konfirmasi ACC)
  {
    dari  : STATUS.PERSETUJUAN_INTERNAL,
    ke    : STATUS.PERSETUJUAN_INTERNAL,
    aktor : ROLES.ATASAN,
    syarat: "Atasan menyetujui secara internal kelayakan usulan ini untuk diajukan ke tingkat nasional."
  },

  // Persetujuan Internal → Sedang Dikerjakan (oleh Atasan - Kembalikan dengan Catatan)
  {
    dari  : STATUS.PERSETUJUAN_INTERNAL,
    ke    : STATUS.SEDANG_DIKERJAKAN,
    aktor : ROLES.ATASAN,
    syarat: "Atasan mengembalikan dokumen usulan ke Anggota Tim untuk diperbaiki secara internal."
  },

  // Juknis Bab VIII D: keputusan lulus penilaian eksternal diterima Atasan.
  {
    dari  : STATUS.PERSETUJUAN_INTERNAL,
    ke    : STATUS.DILANJUTKAN,
    aktor : ROLES.OPERATOR,
    syarat: "Keputusan lulus penilaian eksternal (Provinsi/Kementerian) telah diterima " +
            "secara resmi oleh Atasan dan terdokumentasi."
  },

  // Juknis Bab VI huruf D: Catatan Penilai Eksternal diterima & didokumentasi Operator.
  // Bukan atas keputusan Atasan internal.
  {
    dari  : STATUS.PERSETUJUAN_INTERNAL,
    ke    : STATUS.DIPERBAIKI,
    aktor : ROLES.OPERATOR,
    syarat: "Catatan Penilai Eksternal (Provinsi/Kementerian) telah diterima secara resmi " +
            "dan didokumentasikan oleh Operator di subfolder Putaran yang sesuai. " +
            "Tanpa Catatan Penilai Eksternal yang sah, transisi ini tidak boleh dieksekusi."
  },

  // Setelah Anggota Tim menyelesaikan revisi berdasarkan Catatan Penilai Eksternal,
  // Operator mengembalikan ke Sedang Dikerjakan untuk proses verifikasi ulang Atasan.
  {
    dari  : STATUS.DIPERBAIKI,
    ke    : STATUS.SEDANG_DIKERJAKAN,
    aktor : ROLES.OPERATOR,
    syarat: "Anggota Tim telah menyelesaikan perbaikan sesuai seluruh poin " +
            "Catatan Penilai Eksternal. Dokumen siap diverifikasi ulang oleh Atasan."
  },

  {
    dari  : STATUS.DILANJUTKAN,
    ke    : STATUS.FINAL,
    aktor : ROLES.OPERATOR,
    syarat: "Dokumen penetapan resmi dari Kementerian (SK/Sertifikat) telah tersedia " +
            "dan terdokumentasi di subfolder Penetapan."
  },

  // ── PENANGGUHAN — bisa dari 3 titik ──────────────────────────────────────
  // Juknis Bab VIII huruf E: keputusan penangguhan penilai eksternal disetujui Atasan,
  // dan seluruh dokumen telah disalin ke subfolder Arsip Ditangguhkan.

  // Persetujuan Internal → Ditangguhkan (oleh Operator)
  {
    dari  : STATUS.PERSETUJUAN_INTERNAL,
    ke    : STATUS.DITANGGUHKAN,
    aktor : ROLES.OPERATOR,
    syarat: "Keputusan penangguhan dari penilai eksternal (Provinsi/Kementerian) " +
            "disetujui Atasan. Seluruh dokumen telah disalin ke subfolder Arsip Ditangguhkan."
  },

  // Persetujuan Internal → Ditangguhkan (oleh Atasan)
  {
    dari  : STATUS.PERSETUJUAN_INTERNAL,
    ke    : STATUS.DITANGGUHKAN,
    aktor : ROLES.ATASAN,
    syarat: "Keputusan penangguhan dari penilai eksternal (Provinsi/Kementerian) disetujui Atasan."
  },

  // Diperbaiki → Ditangguhkan (oleh Operator)
  {
    dari  : STATUS.DIPERBAIKI,
    ke    : STATUS.DITANGGUHKAN,
    aktor : ROLES.OPERATOR,
    syarat: "Keputusan penangguhan dari penilai eksternal (Provinsi/Kementerian) " +
            "disetujui Atasan setelah putaran revisi. " +
            "Seluruh dokumen telah disalin ke subfolder Arsip Ditangguhkan."
  },

  // Diperbaiki → Ditangguhkan (oleh Atasan)
  {
    dari  : STATUS.DIPERBAIKI,
    ke    : STATUS.DITANGGUHKAN,
    aktor : ROLES.ATASAN,
    syarat: "Keputusan penangguhan dari penilai eksternal (Provinsi/Kementerian) disetujui Atasan setelah putaran revisi."
  },

  // Dilanjutkan → Ditangguhkan (oleh Operator)
  {
    dari  : STATUS.DILANJUTKAN,
    ke    : STATUS.DITANGGUHKAN,
    aktor : ROLES.OPERATOR,
    syarat: "Keputusan penangguhan dari penilai eksternal (Provinsi/Kementerian) " +
            "disetujui Atasan pada tahap penetapan. " +
            "Seluruh dokumen telah disalin ke subfolder Arsip Ditangguhkan."
  },

  // Dilanjutkan → Ditangguhkan (oleh Atasan)
  {
    dari  : STATUS.DILANJUTKAN,
    ke    : STATUS.DITANGGUHKAN,
    aktor : ROLES.ATASAN,
    syarat: "Keputusan penangguhan dari penilai eksternal (Provinsi/Kementerian) disetujui Atasan pada tahap penetapan."
  }

];


// ─────────────────────────────────────────────
// 4. FUNGSI VALIDASI TRANSISI
//
// Lempar error jika transisi tidak valid —
// jangan biarkan status berubah diam-diam.
// ─────────────────────────────────────────────

/**
 * Memvalidasi apakah transisi status diizinkan berdasarkan TRANSITIONS matrix.
 *
 * @param {string|null} dariStatus  - Status asal (null jika entry point baru)
 * @param {string}      keStatus    - Status tujuan
 * @param {string}      aktorRole   - Peran pengguna yang mengeksekusi (dari ROLES)
 * @param {string}      entryType   - Opsional, hanya relevan untuk entry point (dari ENTRY_TYPE)
 * @returns {object}                - { valid: boolean, transisi: object|null, pesan: string }
 */
function validateTransisi(dariStatus, keStatus, aktorRole, entryType) {
  var cocok = TRANSITIONS.filter(function(t) {
    var dariCocok = t.dari === dariStatus;
    var keCocok   = t.ke   === keStatus;
    var aktorCocok = t.aktor === aktorRole;
    var entryTypeCocok = !t.entry_type || t.entry_type === entryType;
    return dariCocok && keCocok && aktorCocok && entryTypeCocok;
  });

  if (cocok.length === 0) {
    return {
      valid    : false,
      transisi : null,
      pesan    : "Transisi tidak valid: '" + dariStatus + "' → '" + keStatus + "' " +
                 "oleh peran '" + aktorRole + "'. " +
                 "Periksa kewenangan dan syarat di Juknis Bab VIII."
    };
  }

  return {
    valid    : true,
    transisi : cocok[0],
    pesan    : "Transisi valid. Syarat: " + cocok[0].syarat
  };
}


/**
 * Mengembalikan daftar transisi yang tersedia dari status tertentu
 * untuk peran tertentu. Berguna untuk render tombol aksi di UI.
 *
 * @param {string|null} dariStatus - Status aktif folder saat ini
 * @param {string}      aktorRole  - Peran pengguna aktif
 * @returns {Array}                - Array transisi yang diizinkan
 */
function getTransisiTersedia(dariStatus, aktorRole) {
  return TRANSITIONS.filter(function(t) {
    return t.dari === dariStatus && t.aktor === aktorRole;
  });
}


// ─────────────────────────────────────────────
// 5. FUNGSI EKSEKUSI PERUBAHAN STATUS
//
// Satu-satunya pintu masuk yang sah untuk
// mengubah status folder di db_wbtb_lingga.
// ─────────────────────────────────────────────

/**
 * Mengeksekusi perubahan status folder usulan di Google Sheets.
 * Menulis audit log setelah perubahan berhasil.
 *
 * @param {string} proposalId   - ID unik usulan (contoh: "WBTB-001")
 * @param {string} keStatus     - Status tujuan (gunakan konstanta STATUS)
 * @param {string} aktorRole    - Peran pengguna yang mengeksekusi (gunakan konstanta ROLES)
 * @param {string} aktorEmail   - Email pengguna aktif
 * @param {string} entryType    - Opsional, untuk entry point baru (gunakan ENTRY_TYPE)
 * @returns {object}            - Data proposal yang telah diperbarui
 */
function changeStatus(proposalId, keStatus, aktorRole, aktorEmail, entryType) {

  return DatabaseEngine.executeTransaction("db_wbtb_lingga", function(sheet) {
    var data = sheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var dariStatus = null;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === proposalId) {
        targetRowIndex = i + 1;
        dariStatus     = data[i][COL.STATUS];
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error("Proposal ID '" + proposalId + "' tidak ditemukan.");
    }

    // Safeguard tambahan untuk Operator:
    // Operator hanya bisa mengubah status dari Persetujuan Internal jika sudah di-ACC oleh Atasan (is_approved_by_atasan === true)
    if (dariStatus === STATUS.PERSETUJUAN_INTERNAL && aktorRole === ROLES.OPERATOR) {
      var isApproved = data[targetRowIndex - 1][COL.IS_APPROVED_BY_ATASAN] === true || 
                       data[targetRowIndex - 1][COL.IS_APPROVED_BY_ATASAN] === 'TRUE';
      if (!isApproved) {
        throw new Error("Gagal: Usulan '" + proposalId + "' belum disetujui (ACC) oleh Atasan.");
      }
    }

    var hasil = validateTransisi(dariStatus, keStatus, aktorRole, entryType || null);
    if (!hasil.valid) {
      throw new Error(hasil.pesan);
    }

    sheet.getRange(targetRowIndex, COL.STATUS + 1).setValue(keStatus);
	
    if (keStatus === STATUS.DITANGGUHKAN) {
      sheet.getRange(targetRowIndex, COL.DITANGGUHKAN_AT + 1).setValue(new Date());
    }

    if (dariStatus === STATUS.DIPERBAIKI && keStatus === STATUS.SEDANG_DIKERJAKAN) {
      sheet.getRange(targetRowIndex, COL.IS_REVISI_SELESAI + 1).setValue(false);
    }

    // Kelola flag is_approved_by_atasan
    var nextApprovedByAtasan = false;
    if (keStatus === STATUS.PERSETUJUAN_INTERNAL) {
      if (aktorRole === ROLES.ATASAN) {
        nextApprovedByAtasan = true;
      }
    }
    sheet.getRange(targetRowIndex, COL.IS_APPROVED_BY_ATASAN + 1).setValue(nextApprovedByAtasan);

    var revisiRound = parseInt(data[targetRowIndex - 1][COL.REVISI_ROUND] || "0", 10);
    
    // 1. Atasan ACC (Persetujuan Internal -> Persetujuan Internal oleh Atasan)
    var isAtasanACC = (dariStatus === STATUS.PERSETUJUAN_INTERNAL && keStatus === STATUS.PERSETUJUAN_INTERNAL && aktorRole === ROLES.ATASAN);
    if (isAtasanACC) {
      var sourceStage = (revisiRound > 0) ? "REVISI" : "PENGUMPULAN_DATA";
      copyActiveFilesToStage(proposalId, sourceStage, "PENGUSULAN", revisiRound, null, sheet);
    }

    // 2. Ditangguhkan
    if (keStatus === STATUS.DITANGGUHKAN) {
      var currentApproved = data[targetRowIndex - 1][COL.IS_APPROVED_BY_ATASAN] === true || 
                            data[targetRowIndex - 1][COL.IS_APPROVED_BY_ATASAN] === 'TRUE';
      var activeStage = getActiveStageKey(dariStatus, revisiRound, currentApproved);
      copyActiveFilesToStage(proposalId, activeStage, "ARSIP_DITANGGUHKAN", revisiRound, null, sheet);
    }

    // 3. Dilanjutkan (dari tahap aktif sebelumnya ke Penetapan)
    if (keStatus === STATUS.DILANJUTKAN) {
      var currentApproved = data[targetRowIndex - 1][COL.IS_APPROVED_BY_ATASAN] === true || 
                            data[targetRowIndex - 1][COL.IS_APPROVED_BY_ATASAN] === 'TRUE';
      var activeStage = getActiveStageKey(dariStatus, revisiRound, currentApproved);
      copyActiveFilesToStage(proposalId, activeStage, "PENETAPAN", revisiRound, null, sheet);
    }

    // 4. Final (dari Dilanjutkan/Penetapan)
    if (keStatus === STATUS.FINAL && dariStatus === STATUS.DILANJUTKAN) {
      copyActiveFilesToStage(proposalId, "PENETAPAN", "FINAL", null, null, sheet);
    }
	
    writeAuditLog(
      "STATUS_CHANGE",
      "Proposal " + proposalId + " berubah dari '" + dariStatus + "' ke '" + keStatus + "' " +
      "oleh " + aktorRole + " (" + aktorEmail + "). " +
      "Syarat: " + hasil.transisi.syarat
    );

    return {
      proposalId: proposalId,
      dariStatus: dariStatus,
      keStatus  : keStatus,
      aktor     : aktorEmail
    };
  });
}
