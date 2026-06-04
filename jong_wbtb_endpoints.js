/**
 * JONG WBTb — GAS Endpoints (Server-Side API) — VERSI FINAL
 * Gantikan seluruh isi jong_wbtb_endpoints.js yang lama dengan file ini.
 *
 * ATURAN:
 * - Semua fungsi di file ini adalah public — dipanggil via google.script.run
 * - Setiap fungsi WAJIB validasi role sebelum eksekusi
 * - Kembalikan plain object/array — bukan GAS object
 * - Tangkap semua error dan throw dengan pesan yang jelas
 *
 * ENDPOINT BARU VS VERSI SEBELUMNYA:
 * + kembalikanKeAnggota()       — Atasan kembalikan ke Anggota Tim dengan catatan
 * + tangguhkanProposal()        — Atasan tangguhkan proposal
 * + buatFormulirProposal()      — Buat Google Docs formulir baru
 * + naikVersiFormulir()         — Arsip formulir lama, buat versi baru
 * + uploadKajian()              — Upload PDF kajian ke Drive
 * + uploadFoto()                — Upload foto ke Drive
 * + simpanVideoUrl()            — Simpan URL video ke file .txt
 * + jalankanEvaluasiKepatuhan() — Evaluasi kepatuhan seluruh folder
 */


// ════════════════════════════════════════════════
// WEB APP ENTRY POINT
// ════════════════════════════════════════════════

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('jong_wbtb_frontend')
    .setTitle('JONG WBTb — Sistem Pengelolaan WBTb')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// ════════════════════════════════════════════════
// 1. AUTH & USER
// ════════════════════════════════════════════════

function getActiveUserInfo() {
  try {
    var email = getActiveUserEmail();
    var role  = getUserRole(email);
    if (!role) return { email: email, nama: null, role: null };
    var sheet = DatabaseEngine.getSheet(DB_USERS);
    var hasil = DatabaseEngine.findRow(sheet, COL_USER.EMAIL, email);
    var nama  = hasil ? hasil.rowData[COL_USER.NAMA] : email;
    return { email: email, nama: nama, role: role };
  } catch (err) {
    Logger.log('getActiveUserInfo error: ' + err.toString());
    return { email: null, nama: null, role: null };
  }
}


// ════════════════════════════════════════════════
// 2. DASHBOARD
// ════════════════════════════════════════════════

function getDashboardData(requesterEmail) {
  try {
    var role = requireRole(requesterEmail,
      [ROLES.ANGGOTA_TIM, ROLES.OPERATOR, ROLES.ATASAN]);

    var sheet     = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var data      = sheet.getDataRange().getValues();
    var proposals = [];
    var metrics   = { total:0, dikerjakan:0, revisi:0, final:0, ditangguhkan:0 };

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[COL.ID]) continue;
      if (row[COL.ENTRY_TYPE] === ENTRY_TYPE.HISTORIS &&
          row[COL.STATUS] === STATUS.FINAL) continue;

      metrics.total++;
      if (row[COL.STATUS] === STATUS.SEDANG_DIKERJAKAN) metrics.dikerjakan++;
      if (row[COL.STATUS] === STATUS.DIPERBAIKI)         metrics.revisi++;
      if (row[COL.STATUS] === STATUS.FINAL)              metrics.final++;
      if (row[COL.STATUS] === STATUS.DITANGGUHKAN)       metrics.ditangguhkan++;

      proposals.push(buatProposalSummary(row));
    }

    // Self-healing: Pastikan Atasan adalah Editor untuk usulan berstatus Persetujuan Internal
    if (role === ROLES.OPERATOR) {
      try {
        var semuaUser = getAllActiveUsers(requesterEmail);
        var atasans = semuaUser.atasan || [];
        if (atasans.length > 0) {
          for (var i = 1; i < data.length; i++) {
            var row = data[i];
            if (!row[COL.ID] || row[COL.STATUS] !== STATUS.PERSETUJUAN_INTERNAL) continue;
            var folderKaryaId = row[COL.FOLDER_KARYA_ID];
            if (folderKaryaId) {
              try {
                var folder = DriveApp.getFolderById(folderKaryaId);
                atasans.forEach(function(atasan) {
                  folder.addEditor(atasan.email);
                });
              } catch(e) {
                Logger.log("Gagal self-healing addEditor Atasan untuk " + row[COL.ID] + ": " + e.toString());
              }
            }
          }
        }
      } catch(errAkses) {
        Logger.log("Warning: self-healing Atasan permission gagal: " + errAkses.toString());
      }
    }

    if (role === ROLES.ANGGOTA_TIM) {
      proposals = proposals.filter(function(p) {
        return p.penanggungJawabEmail === requesterEmail;
      });
      metrics = hitungMetrics(proposals);
    }

    return { metrics: metrics, proposals: proposals };
  } catch (err) {
    throw new Error('getDashboardData gagal: ' + err.message);
  }
}

function buatProposalSummary(row) {
  return {
    id                   : row[COL.ID],
    namaKarya            : row[COL.NAMA_KARYA],
    domain               : row[COL.DOMAIN],
    tahunUsulan          : row[COL.TAHUN_USULAN],
    entryType            : row[COL.ENTRY_TYPE],
    status               : row[COL.STATUS],
    revisiRound          : row[COL.REVISI_ROUND] || 0,
    penanggungJawabEmail : row[COL.PENANGGUNG_JAWAB_EMAIL],
    penanggungJawabNama  : row[COL.PENANGGUNG_JAWAB_NAMA],
    folderKaryaId        : row[COL.FOLDER_KARYA_ID],
    driveLocked          : row[COL.DRIVE_LOCKED],
    isApprovedByAtasan   : row[COL.IS_APPROVED_BY_ATASAN] === true || row[COL.IS_APPROVED_BY_ATASAN] === 'TRUE',
    isRevisiSelesai      : row[COL.IS_REVISI_SELESAI] === true || row[COL.IS_REVISI_SELESAI] === 'TRUE',
    createdAt            : row[COL.CREATED_AT]
                           ? new Date(row[COL.CREATED_AT]).toISOString() : null,
    updatedAt            : row[COL.UPDATED_AT]
                           ? new Date(row[COL.UPDATED_AT]).toISOString()  : null
  };
}

function hitungMetrics(proposals) {
  var m = { total:0, dikerjakan:0, revisi:0, final:0, ditangguhkan:0 };
  proposals.forEach(function(p) {
    m.total++;
    if (p.status === STATUS.SEDANG_DIKERJAKAN) m.dikerjakan++;
    if (p.status === STATUS.DIPERBAIKI)         m.revisi++;
    if (p.status === STATUS.FINAL)              m.final++;
    if (p.status === STATUS.DITANGGUHKAN)       m.ditangguhkan++;
  });
  return m;
}


// ════════════════════════════════════════════════
// 3. CREATE PROPOSAL
// ════════════════════════════════════════════════

function createProposal(operatorEmail, data) {
  try {
    requireRole(operatorEmail, ROLES.OPERATOR);

    if (!data.namaKarya || !data.judulSingkat || !data.domain ||
        !data.penanggungJawabEmail) {
      throw new Error('Semua field wajib diisi.');
    }

    var validasiJudul = validateJudulSingkat(data.judulSingkat);
    if (!validasiJudul.valid) throw new Error(validasiJudul.pesan);

    var pjRole = getUserRole(data.penanggungJawabEmail);
    if (!pjRole) {
      throw new Error('Email penanggung jawab tidak terdaftar di sistem.');
    }

    var proposalId = DatabaseEngine.executeTransaction(
      DB_NAMES.WBTB_LINGGA,
      function(sheet) { return generateProposalId(sheet); }
    );

    var hasilFolder = initProposalWorkspace(proposalId, data.namaKarya);

    // Set Drive permission
    try {
      var folderKarya = DriveApp.getFolderById(hasilFolder.folderKaryaId);
      folderKarya.addEditor(data.penanggungJawabEmail);
      var semuaUser = getAllActiveUsers(operatorEmail);
      semuaUser.atasan.forEach(function(atasan) {
        folderKarya.addEditor(atasan.email); // Diberi hak Editor agar Atasan bisa copy file saat ACC
      });
    } catch (driveErr) {
      Logger.log('Warning: gagal set Drive permission: ' + driveErr.toString());
    }

    // Ambil nama PJ
    var sheetUser = DatabaseEngine.getSheet(DB_USERS);
    var hasilPJ   = DatabaseEngine.findRow(sheetUser, COL_USER.EMAIL,
      data.penanggungJawabEmail);
    var pjNama    = hasilPJ ? hasilPJ.rowData[COL_USER.NAMA] : data.penanggungJawabEmail;

    // Simpan ke database
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
      var now     = new Date();
      var rowData = new Array(TOTAL_COLS_WBTB).fill('');
      rowData[COL.ID]                     = proposalId;
      rowData[COL.NAMA_KARYA]             = data.namaKarya;
      rowData[COL.DOMAIN]                 = data.domain;
      rowData[COL.TAHUN_USULAN]           = new Date().getFullYear();
      rowData[COL.ENTRY_TYPE]             = ENTRY_TYPE.NORMAL;
      rowData[COL.STATUS]                 = STATUS.SEDANG_DIKERJAKAN;
      rowData[COL.REVISI_ROUND]           = 0;
      rowData[COL.PENANGGUNG_JAWAB_EMAIL] = data.penanggungJawabEmail;
      rowData[COL.PENANGGUNG_JAWAB_NAMA]  = pjNama;
      rowData[COL.CATATAN_ATASAN]         = '';
      rowData[COL.FOLDER_KARYA_ID]        = hasilFolder.folderKaryaId;
      rowData[COL.FOLDER_IDS_JSON]        = JSON.stringify(hasilFolder.folderIds);
      rowData[COL.DOC_ACTIVE_ID]          = '';
      rowData[COL.DOC_HISTORY_JSON]       = JSON.stringify({});
      rowData[COL.KAJIAN_FILES_JSON]      = JSON.stringify([]);
      rowData[COL.FOTO_FILES_JSON]        = JSON.stringify([]);
      rowData[COL.VIDEO_URL]              = '';
      rowData[COL.SERTIFIKAT_FILES_JSON]  = JSON.stringify([]);
      rowData[COL.CATATAN_PENILAI_JSON]   = JSON.stringify([]);
      rowData[COL.DRIVE_LOCKED]           = false;
      rowData[COL.CREATED_AT]             = now;
      rowData[COL.UPDATED_AT]             = now;
      rowData[COL.JUDUL_SINGKAT]          = data.judulSingkat;
      rowData[COL.DITANGGUHKAN_AT]        = '';
      rowData[COL.IS_APPROVED_BY_ATASAN]  = false;
      rowData[COL.IS_REVISI_SELESAI]      = false;
      sheet.appendRow(rowData);
    });

    writeAuditLog(ACTION_TYPES.WORKSPACE_INIT_SUCCESS,
      'Proposal baru: ' + proposalId + ' — ' + data.namaKarya +
      '. PJ: ' + pjNama + '. Operator: ' + operatorEmail, proposalId);

    return {
      proposalId    : proposalId,
      namaKarya     : data.namaKarya,
      folderKaryaId : hasilFolder.folderKaryaId,
      folderUrl     : 'https://drive.google.com/drive/folders/' + hasilFolder.folderKaryaId
    };
  } catch (err) {
    throw new Error('createProposal gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 4. PROPOSAL DETAIL
// ════════════════════════════════════════════════

function getProposalDetail(requesterEmail, proposalId) {
  try {
    requireRole(requesterEmail,
      [ROLES.ANGGOTA_TIM, ROLES.OPERATOR, ROLES.ATASAN]);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal \'' + proposalId + '\' tidak ditemukan.');

    var row = hasil.rowData;

    if (getUserRole(requesterEmail) === ROLES.ANGGOTA_TIM) {
      if (row[COL.PENANGGUNG_JAWAB_EMAIL] !== requesterEmail) {
        throw new Error('Akses ditolak: folder ini bukan tanggung jawabmu.');
      }
    }

    var kajianFiles    = safeParseJSON(row[COL.KAJIAN_FILES_JSON],    []);
    var fotoFiles      = safeParseJSON(row[COL.FOTO_FILES_JSON],      []);
    var catatanPenilai = safeParseJSON(row[COL.CATATAN_PENILAI_JSON], []);
    var docHistory     = safeParseJSON(row[COL.DOC_HISTORY_JSON],     {});
    var folderIds      = safeParseJSON(row[COL.FOLDER_IDS_JSON],      {});

    return {
      id                   : row[COL.ID],
      namaKarya            : row[COL.NAMA_KARYA],
      judulSingkat         : row[COL.JUDUL_SINGKAT],
      domain               : row[COL.DOMAIN],
      tahunUsulan          : row[COL.TAHUN_USULAN],
      entryType            : row[COL.ENTRY_TYPE],
      status               : row[COL.STATUS],
      revisiRound          : row[COL.REVISI_ROUND] || 0,
      penanggungJawabEmail : row[COL.PENANGGUNG_JAWAB_EMAIL],
      penanggungJawabNama  : row[COL.PENANGGUNG_JAWAB_NAMA],
      catatanAtasan        : row[COL.CATATAN_ATASAN],
      folderKaryaId        : row[COL.FOLDER_KARYA_ID],
      folderIds            : folderIds,
      docActiveId          : row[COL.DOC_ACTIVE_ID],
      docHistory           : docHistory,
      kajianFiles          : kajianFiles.filter(function(f) { return f.status==='aktif'; }),
      fotoFiles            : fotoFiles.filter(function(f)   { return f.status==='aktif'; }),
      videoUrl             : row[COL.VIDEO_URL],
      catatanPenilai       : catatanPenilai,
      driveLocked          : row[COL.DRIVE_LOCKED],
      isApprovedByAtasan   : row[COL.IS_APPROVED_BY_ATASAN] === true || row[COL.IS_APPROVED_BY_ATASAN] === 'TRUE',
      isRevisiSelesai      : row[COL.IS_REVISI_SELESAI] === true || row[COL.IS_REVISI_SELESAI] === 'TRUE',
      ditangguhkanAt       : row[COL.DITANGGUHKAN_AT]
                             ? new Date(row[COL.DITANGGUHKAN_AT]).toISOString() : null,
      createdAt            : row[COL.CREATED_AT]
                             ? new Date(row[COL.CREATED_AT]).toISOString() : null,
      updatedAt            : row[COL.UPDATED_AT]
                             ? new Date(row[COL.UPDATED_AT]).toISOString()  : null,
      transisiTersedia     : getTransisiTersedia(
                               row[COL.STATUS], getUserRole(requesterEmail))
    };
  } catch (err) {
    throw new Error('getProposalDetail gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 5. STATUS MANAGEMENT
// ════════════════════════════════════════════════

function updateProposalStatus(requesterEmail, proposalId, keStatus) {
  try {
    var role = requireRole(requesterEmail,
      [ROLES.ANGGOTA_TIM, ROLES.OPERATOR, ROLES.ATASAN]);
    var hasil = changeStatus(proposalId, keStatus, role, requesterEmail, null);
    if (keStatus === STATUS.FINAL || keStatus === STATUS.DITANGGUHKAN) {
      kunciFolderDrive(proposalId, requesterEmail);
    }
    return hasil;
  } catch (err) {
    throw new Error('updateProposalStatus gagal: ' + err.message);
  }
}

/**
 * Atasan kembalikan folder ke Anggota Tim dengan catatan internal.
 * Status → SEDANG_DIKERJAKAN. Catatan disimpan di kolom catatan_atasan.
 */
function kembalikanKeAnggota(atasanEmail, proposalId, catatan) {
  try {
    requireRole(atasanEmail, ROLES.ATASAN);
    if (!catatan || catatan.indexOf('1.') === -1) {
      throw new Error('Format catatan harus poin bernomor. Minimal ada "1."');
    }
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
      var h = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
      if (!h) throw new Error('Proposal tidak ditemukan.');
      sheet.getRange(h.rowIndex, COL.CATATAN_ATASAN + 1).setValue(catatan);
      sheet.getRange(h.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
    });
    writeAuditLog(ACTION_TYPES.CATATAN_ATASAN_SET,
      'Catatan internal Atasan disimpan untuk ' + proposalId +
      '. Dikembalikan oleh: ' + atasanEmail, proposalId);
    return changeStatus(proposalId, STATUS.SEDANG_DIKERJAKAN,
      ROLES.ATASAN, atasanEmail, null);
  } catch (err) {
    throw new Error('kembalikanKeAnggota gagal: ' + err.message);
  }
}

/**
 * Atasan tangguhkan proposal secara permanen.
 */
function tangguhkanProposal(atasanEmail, proposalId, alasan) {
  try {
    requireRole(atasanEmail, ROLES.ATASAN);
    if (!alasan) throw new Error('Alasan penangguhan wajib diisi.');
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
      var h = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
      if (!h) throw new Error('Proposal tidak ditemukan.');
      sheet.getRange(h.rowIndex, COL.CATATAN_ATASAN + 1).setValue(alasan);
      sheet.getRange(h.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
    });
    return updateProposalStatus(atasanEmail, proposalId, STATUS.DITANGGUHKAN);
  } catch (err) {
    throw new Error('tangguhkanProposal gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 6. DRIVE PERMISSION
// ════════════════════════════════════════════════

function kunciFolderDrive(proposalId, operatorEmail) {
  try {
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) return;
    var folderKaryaId = hasil.rowData[COL.FOLDER_KARYA_ID];
    var pjEmail       = hasil.rowData[COL.PENANGGUNG_JAWAB_EMAIL];
    if (!folderKaryaId || !pjEmail) return;

    var folder = DriveApp.getFolderById(folderKaryaId);
    folder.removeEditor(pjEmail);
    folder.addViewer(pjEmail);
    kunciFolderRekursif(folder, pjEmail);

    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
      var h = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
      if (h) {
        sheetTx.getRange(h.rowIndex, COL.DRIVE_LOCKED + 1).setValue(true);
        sheetTx.getRange(h.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
      }
    });

    writeAuditLog(ACTION_TYPES.DRIVE_ACCESS_FROZEN,
      'Folder dikunci. PJ ' + pjEmail + ' → Viewer. ID: ' + folderKaryaId,
      proposalId);
  } catch (err) {
    Logger.log('kunciFolderDrive error: ' + err.toString());
  }
}

function kunciFolderRekursif(folder, userEmail) {
  var iterFiles = folder.getFiles();
  while (iterFiles.hasNext()) {
    var file = iterFiles.next();
    try { file.removeEditor(userEmail); file.addViewer(userEmail); } catch(e) {}
  }
  var iterFolders = folder.getFolders();
  while (iterFolders.hasNext()) {
    var sub = iterFolders.next();
    try { sub.removeEditor(userEmail); sub.addViewer(userEmail); } catch(e) {}
    kunciFolderRekursif(sub, userEmail);
  }
}


// ════════════════════════════════════════════════
// 7. FORMULIR
// ════════════════════════════════════════════════

/**
 * Membuat Google Docs formulir baru untuk proposal.
 * Disimpan di subfolder 01_PENGUMPULAN-DATA/FORMULIR-USULAN/
 */
function buatFormulirProposal(anggotaEmail, proposalId) {
  try {
    requireRole(anggotaEmail, ROLES.ANGGOTA_TIM);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row           = hasil.rowData;
    var judulSingkat  = row[COL.JUDUL_SINGKAT];
    var namaKarya     = row[COL.NAMA_KARYA];
    var folderIds     = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var folderPDId    = folderIds['PENGUMPULAN_DATA'];

    if (!folderPDId) throw new Error('Folder Pengumpulan Data tidak ditemukan.');
    if (row[COL.DOC_ACTIVE_ID]) throw new Error('Formulir sudah ada. Gunakan Naik Versi untuk membuat versi baru.');

    // Cari subfolder FORMULIR-USULAN
    var folderPD       = DriveApp.getFolderById(folderPDId);
    var iterFormulir   = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.FORMULIR_USULAN);
    if (!iterFormulir.hasNext()) throw new Error('Subfolder FORMULIR-USULAN tidak ditemukan.');
    var folderFormulir = iterFormulir.next();

    // Buat nama file sesuai Juknis
    var namaFileStr  = namaFile(JENIS_DOK.FORMULIR, judulSingkat, { versi: 1 });
var fileTemplate = DriveApp.getFileById(TEMPLATE_FORMULIR_ID);
var fileCopy     = fileTemplate.makeCopy(namaFileStr, folderFormulir);

var docHistory   = {};
docHistory['v1'] = fileCopy.getId();

DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
  var h = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
  sheetTx.getRange(h.rowIndex, COL.DOC_ACTIVE_ID + 1).setValue(fileCopy.getId());
  sheetTx.getRange(h.rowIndex, COL.DOC_HISTORY_JSON + 1)
    .setValue(JSON.stringify(docHistory));
  sheetTx.getRange(h.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
});

writeAuditLog(ACTION_TYPES.FORMULIR_VERSI_BARU,
  'Formulir v1 dibuat dari template: ' + namaFileStr + '. Doc ID: ' + fileCopy.getId(),
  proposalId);

return { docId: fileCopy.getId(), namaFile: namaFileStr };
  } catch (err) {
    throw new Error('buatFormulirProposal gagal: ' + err.message);
  }
}

/**
 * Arsip formulir versi aktif dan buat versi baru.
 */
function naikVersiFormulir(anggotaEmail, proposalId) {
  try {
    requireRole(anggotaEmail, ROLES.ANGGOTA_TIM);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row          = hasil.rowData;
    var docActiveId  = row[COL.DOC_ACTIVE_ID];
    var judulSingkat = row[COL.JUDUL_SINGKAT];
    var folderIds    = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var docHistory   = safeParseJSON(row[COL.DOC_HISTORY_JSON], {});
    var versiKeys    = Object.keys(docHistory);
    var versiLama    = versiKeys.length;

    if (!docActiveId) throw new Error('Belum ada formulir aktif.');

    // Cari folder FORMULIR-USULAN di tahap aktif
    var folderPDId    = folderIds['PENGUMPULAN_DATA'];
    var folderPD      = DriveApp.getFolderById(folderPDId);
    var iterFormulir  = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.FORMULIR_USULAN);
    if (!iterFormulir.hasNext()) throw new Error('Folder FORMULIR-USULAN tidak ditemukan.');
    var folderFormulirId = iterFormulir.next().getId();

    // Arsip versi lama
    var hasilArsip = arsipFormulirVersi(
      proposalId, folderFormulirId, docActiveId, versiLama, anggotaEmail
    );

    // Update doc_history dan doc_active_id
    docHistory['v' + hasilArsip.versiBaru] = hasilArsip.newDocId;

    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
      var h = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
      sheetTx.getRange(h.rowIndex, COL.DOC_ACTIVE_ID + 1)
        .setValue(hasilArsip.newDocId);
      sheetTx.getRange(h.rowIndex, COL.DOC_HISTORY_JSON + 1)
        .setValue(JSON.stringify(docHistory));
      sheetTx.getRange(h.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
    });

    return hasilArsip;
  } catch (err) {
    throw new Error('naikVersiFormulir gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 8. UPLOAD KAJIAN
// ════════════════════════════════════════════════

/**
 * Upload file kajian ilmiah PDF ke Drive.
 * Jika gantiFileId diisi, arsipkan file lama terlebih dahulu.
 *
 * @param {string} anggotaEmail
 * @param {string} proposalId
 * @param {object} fileMeta - { name, mimeType, base64, sizeBytes, gantiFileId }
 */
function uploadKajian(anggotaEmail, proposalId, fileMeta) {
  try {
    requireRole(anggotaEmail, ROLES.ANGGOTA_TIM);

    // Validasi server-side
    var validasi = validateFilePDF(fileMeta);
    if (!validasi.valid) throw new Error(validasi.pesan);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row           = hasil.rowData;
    var judulSingkat  = row[COL.JUDUL_SINGKAT];
    var revisiRound   = parseInt(row[COL.REVISI_ROUND] || '0', 10);
    var folderIds     = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var kajianFiles   = safeParseJSON(row[COL.KAJIAN_FILES_JSON], []);

    // Tentukan folder tujuan berdasarkan status
    var folderTahapId = folderIds['PENGUMPULAN_DATA'];
    if (revisiRound > 0 && row[COL.STATUS] === STATUS.DIPERBAIKI) {
      // Upload ke subfolder putaran revisi aktif
      var folderRevisiId  = folderIds['REVISI'];
      var folderRevisi    = DriveApp.getFolderById(folderRevisiId);
      var namaPutaran     = formatNamaPutaran(revisiRound);
      var iterPutaran     = folderRevisi.getFoldersByName(namaPutaran);
      if (iterPutaran.hasNext()) {
        var folderPutaran = iterPutaran.next();
        var iterKajian    = folderPutaran.getFoldersByName(FOLDER_NAMES.JENIS.KAJIAN_ILMIAH);
        if (iterKajian.hasNext()) folderTahapId = iterKajian.next().getId();
      }
    } else {
      // Upload ke 01_PENGUMPULAN-DATA/KAJIAN-ILMIAH
      var folderPD   = DriveApp.getFolderById(folderTahapId);
      var iterKajian = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.KAJIAN_ILMIAH);
      if (iterKajian.hasNext()) folderTahapId = iterKajian.next().getId();
    }

    // Arsip file lama jika ada
    if (fileMeta.gantiFileId) {
      arsipKajianFile(proposalId, folderTahapId, fileMeta.gantiFileId, anggotaEmail);
      kajianFiles = tandaiFileDiarsip(kajianFiles, fileMeta.gantiFileId,
        fileMeta.gantiFileId);
    }

    // Hitung nomor urut
    var nomorUrut    = kajianFiles.filter(function(f) { return f.status==='aktif'; }).length + 1;
    var versi        = fileMeta.gantiFileId
      ? (kajianFiles.find(function(f) { return f.fileId===fileMeta.gantiFileId; }) || {versi:0}).versi + 1
      : 1;

    // Generate nama file sesuai Juknis
    var jenisDok  = revisiRound > 0 ? JENIS_DOK.KAJIAN_REVISI : JENIS_DOK.KAJIAN;
    var params    = revisiRound > 0
      ? { putaran: revisiRound, nomorUrut: nomorUrut }
      : { nomorUrut: nomorUrut };
    var namaFileKajian = namaFile(jenisDok, judulSingkat, params);

    // Upload ke Drive
    var base64Data = fileMeta.base64.indexOf(',') !== -1
      ? fileMeta.base64.split(',')[1] : fileMeta.base64;
    var blob    = Utilities.newBlob(
      Utilities.base64Decode(base64Data), fileMeta.mimeType, namaFileKajian + '.pdf');
    var folder  = DriveApp.getFolderById(folderTahapId);
    var file    = folder.createFile(blob);

    // Update metadata
    var newMeta = buildFileMetadata(file.getId(), namaFileKajian + '.pdf', versi, anggotaEmail);
    kajianFiles.push(newMeta);
    updateFileMetadata(proposalId, COL.KAJIAN_FILES_JSON, kajianFiles);

    writeAuditLog(ACTION_TYPES.KAJIAN_UPLOAD,
      'Kajian diunggah: ' + namaFileKajian + '. File ID: ' + file.getId(),
      proposalId);

    return { fileId: file.getId(), namaFile: namaFileKajian };
  } catch (err) {
    throw new Error('uploadKajian gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 9. UPLOAD FOTO
// ════════════════════════════════════════════════

/**
 * Upload satu atau lebih foto ke Drive.
 *
 * @param {string} anggotaEmail
 * @param {string} proposalId
 * @param {object} payload - { files: [{name,mimeType,base64,sizeBytes}], gantiFileId }
 */
function uploadFoto(anggotaEmail, proposalId, payload) {
  try {
    requireRole(anggotaEmail, ROLES.ANGGOTA_TIM);

    // Validasi total payload
    var validasiTotal = validateTotalPayload(payload.files);
    if (!validasiTotal.valid) throw new Error(validasiTotal.pesan);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row          = hasil.rowData;
    var judulSingkat = row[COL.JUDUL_SINGKAT];
    var revisiRound  = parseInt(row[COL.REVISI_ROUND] || '0', 10);
    var folderIds    = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var fotoFiles    = safeParseJSON(row[COL.FOTO_FILES_JSON], []);

    // Folder tujuan
    var folderTahapId = folderIds['PENGUMPULAN_DATA'];
    var folderPD      = DriveApp.getFolderById(folderTahapId);
    var iterFoto      = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.FOTO_DOKUMENTASI);
    var folderFotoId  = iterFoto.hasNext() ? iterFoto.next().getId() : folderTahapId;

    // Arsip file lama jika ada
    if (payload.gantiFileId) {
      arsipFotoFile(proposalId, folderFotoId, payload.gantiFileId, anggotaEmail);
      fotoFiles = tandaiFileDiarsip(fotoFiles, payload.gantiFileId, payload.gantiFileId);
    }

    var hasilUpload = [];
    var nomorBase   = fotoFiles.filter(function(f) { return f.status==='aktif'; }).length;

    payload.files.forEach(function(fileMeta, idx) {
      // Validasi per file
      var validasi = validateFileFoto(fileMeta);
      if (!validasi.valid) throw new Error(fileMeta.name + ': ' + validasi.pesan);

      var nomorUrut   = nomorBase + idx + 1;
      var namaFileFoto = namaFile(JENIS_DOK.FOTO, judulSingkat, { nomorUrut: nomorUrut });
      var ext         = fileMeta.mimeType === 'image/png' ? '.png' : '.jpg';

      var base64Data  = fileMeta.base64.indexOf(',') !== -1
        ? fileMeta.base64.split(',')[1] : fileMeta.base64;
      var blob    = Utilities.newBlob(
        Utilities.base64Decode(base64Data), fileMeta.mimeType, namaFileFoto + ext);
      var folder  = DriveApp.getFolderById(folderFotoId);
      var file    = folder.createFile(blob);

      var newMeta = buildFileMetadata(file.getId(), namaFileFoto + ext, 1, anggotaEmail);
      fotoFiles.push(newMeta);
      hasilUpload.push({ fileId: file.getId(), namaFile: namaFileFoto + ext });
    });

    updateFileMetadata(proposalId, COL.FOTO_FILES_JSON, fotoFiles);

    writeAuditLog(ACTION_TYPES.FOTO_UPLOAD,
      payload.files.length + ' foto diunggah untuk ' + proposalId, proposalId);

    return hasilUpload;
  } catch (err) {
    throw new Error('uploadFoto gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 10. SIMPAN URL VIDEO
// ════════════════════════════════════════════════

function simpanVideoUrl(anggotaEmail, proposalId, url, keterangan) {
  try {
    requireRole(anggotaEmail, ROLES.ANGGOTA_TIM);

    var validasi = validateVideoUrl(url);
    if (!validasi.valid) throw new Error(validasi.pesan);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row           = hasil.rowData;
    var namaKarya     = row[COL.NAMA_KARYA];
    var folderIds     = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var fileIdLama    = null;

    // Cari file .txt URL lama jika ada
    var videoUrl = row[COL.VIDEO_URL];
    if (videoUrl) {
      // Cari file .txt di folder VIDEO-DOKUMENTASI
      var folderPDId = folderIds['PENGUMPULAN_DATA'];
      var folderPD   = DriveApp.getFolderById(folderPDId);
      var iterVideo  = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
      if (iterVideo.hasNext()) {
        var folderVideo = iterVideo.next();
        var iterFiles   = folderVideo.getFiles();
        while (iterFiles.hasNext()) {
          var f = iterFiles.next();
          if (f.getMimeType() === 'text/plain') {
            fileIdLama = f.getId();
            break;
          }
        }
      }
    }

    // Arsip URL lama dan buat file .txt baru
    var judulSingkat = row[COL.JUDUL_SINGKAT];
    var folderPDId2  = folderIds['PENGUMPULAN_DATA'];
    var folderPD2    = DriveApp.getFolderById(folderPDId2);
    var iterVideo2   = folderPD2.getFoldersByName(FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
    var folderVideoId = iterVideo2.hasNext() ? iterVideo2.next().getId() : folderPDId2;

    var nomorUrut = 1; // default, bisa dikembangkan untuk multi-video
    arsipVideoUrl(proposalId, judulSingkat, folderVideoId, fileIdLama,
      url, keterangan, nomorUrut, anggotaEmail);

    // Update kolom video_url di sheet
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
      var h = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
      sheetTx.getRange(h.rowIndex, COL.VIDEO_URL + 1).setValue(url);
      sheetTx.getRange(h.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
    });

    return { url: url };
  } catch (err) {
    throw new Error('simpanVideoUrl gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 11. VERIFIKASI MANDIRI
// ════════════════════════════════════════════════

function cekVerifikasiMandiri(requesterEmail, proposalId) {
  try {
    requireRole(requesterEmail, ROLES.ANGGOTA_TIM);
    return verifikasiMandiri(proposalId);
  } catch (err) {
    throw new Error('cekVerifikasiMandiri gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 12. CATATAN PENILAI
// ════════════════════════════════════════════════

function submitCatatanPenilai(operatorEmail, proposalId, catatan, sumber, tanggalTerima) {
  try {
    return entryCatatanPenilai(operatorEmail, proposalId, catatan, sumber, tanggalTerima);
  } catch (err) {
    throw new Error('submitCatatanPenilai gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 13. ARSIP HISTORIS
// ════════════════════════════════════════════════

function getArsipHistoris(requesterEmail) {
  try {
    requireRole(requesterEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR, ROLES.ATASAN]);
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var data  = sheet.getDataRange().getValues();
    var arsip = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[COL.ID]) continue;
      if (row[COL.ENTRY_TYPE] === ENTRY_TYPE.HISTORIS) {
        arsip.push(buatProposalSummary(row));
      }
    }
    return arsip;
  } catch (err) {
    throw new Error('getArsipHistoris gagal: ' + err.message);
  }
}

function createArsipHistoris(operatorEmail, data) {
  try {
    requireRole(operatorEmail, ROLES.OPERATOR);
    if (!data.namaKarya || !data.judulSingkat || !data.domain || !data.tahunPenetapan) {
      throw new Error('Semua field wajib diisi.');
    }
    var validasiJudul = validateJudulSingkat(data.judulSingkat);
    if (!validasiJudul.valid) throw new Error(validasiJudul.pesan);

    var proposalId  = DatabaseEngine.executeTransaction(
      DB_NAMES.WBTB_LINGGA,
      function(sheet) { return generateProposalId(sheet); }
    );
    var hasilFolder = initHistorisWorkspace(proposalId, data.namaKarya);

    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
      var now     = new Date();
      var rowData = new Array(TOTAL_COLS_WBTB).fill('');
      rowData[COL.ID]                    = proposalId;
      rowData[COL.NAMA_KARYA]            = data.namaKarya;
      rowData[COL.DOMAIN]                = data.domain;
      rowData[COL.TAHUN_USULAN]          = data.tahunPenetapan;
      rowData[COL.ENTRY_TYPE]            = ENTRY_TYPE.HISTORIS;
      rowData[COL.STATUS]                = STATUS.FINAL;
      rowData[COL.REVISI_ROUND]          = 0;
      rowData[COL.PENANGGUNG_JAWAB_EMAIL]= operatorEmail;
      rowData[COL.PENANGGUNG_JAWAB_NAMA] = 'Operator (Import Historis)';
      rowData[COL.FOLDER_KARYA_ID]       = hasilFolder.folderKaryaId;
      rowData[COL.FOLDER_IDS_JSON]       = JSON.stringify({});
      rowData[COL.KAJIAN_FILES_JSON]     = JSON.stringify([]);
      rowData[COL.FOTO_FILES_JSON]       = JSON.stringify([]);
      rowData[COL.SERTIFIKAT_FILES_JSON] = JSON.stringify([]);
      rowData[COL.CATATAN_PENILAI_JSON]  = JSON.stringify([]);
      rowData[COL.DRIVE_LOCKED]          = true;
      rowData[COL.CREATED_AT]            = now;
      rowData[COL.UPDATED_AT]            = now;
      rowData[COL.JUDUL_SINGKAT]         = data.judulSingkat;
      rowData[COL.DITANGGUHKAN_AT]       = '';
      rowData[COL.IS_APPROVED_BY_ATASAN] = true;
      rowData[COL.IS_REVISI_SELESAI]     = false;
      sheet.appendRow(rowData);
    });

    return {
      proposalId    : proposalId,
      folderKaryaId : hasilFolder.folderKaryaId,
      folderUrl     : 'https://drive.google.com/drive/folders/' + hasilFolder.folderKaryaId
    };
  } catch (err) {
    throw new Error('createArsipHistoris gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 14. LOG AKTIVITAS
// ════════════════════════════════════════════════

function getLogAktivitas(requesterEmail, halaman, perHalaman) {
  try {
    requireRole(requesterEmail, [ROLES.OPERATOR, ROLES.ATASAN]);
    var sheet  = DatabaseEngine.getSheet(DB_NAMES.ACTIVITY_LOG);
    var data   = sheet.getDataRange().getValues();
    var rows   = data.slice(1).reverse();
    var limit  = perHalaman || 15;
    var page   = halaman || 1;
    var sliced = rows.slice((page-1)*limit, page*limit);

    var logs = sliced.map(function(row) {
      return {
        timestamp  : row[COL_LOG.TIMESTAMP]
                     ? new Date(row[COL_LOG.TIMESTAMP]).toISOString() : null,
        userEmail  : row[COL_LOG.USER_EMAIL],
        userRole   : row[COL_LOG.USER_ROLE],
        proposalId : row[COL_LOG.PROPOSAL_ID],
        actionType : row[COL_LOG.ACTION_TYPE],
        detail     : row[COL_LOG.DETAIL]
      };
    });

    return {
      logs         : logs,
      totalHalaman : Math.ceil(rows.length / limit),
      halamanAktif : page,
      totalLog     : rows.length
    };
  } catch (err) {
    throw new Error('getLogAktivitas gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 15. KELOLA AKSES
// ════════════════════════════════════════════════

function addUserAccess(operatorEmail, emailBaru, roleBaru, namaBaru, catatan) {
  try {
    return tambahAksesUser(operatorEmail, emailBaru, roleBaru, namaBaru, catatan);
  } catch (err) {
    throw new Error('addUserAccess gagal: ' + err.message);
  }
}

function revokeUserAccess(operatorEmail, emailTarget, catatan) {
  try {
    return cabutAksesUser(operatorEmail, emailTarget, catatan);
  } catch (err) {
    throw new Error('revokeUserAccess gagal: ' + err.message);
  }
}

function getAllUsers(requesterEmail) {
  try {
    requireRole(requesterEmail, [ROLES.OPERATOR, ROLES.ATASAN]);
    var sheet      = DatabaseEngine.getSheet(DB_USERS);
    var data       = sheet.getDataRange().getValues();
    var aktif      = { atasan:[], operator:[], anggotaTim:[] };
    var tidakAktif = [];

    for (var i = 1; i < data.length; i++) {
      var row     = data[i];
      var isAktif = row[COL_USER.AKTIF] === true || row[COL_USER.AKTIF] === 'TRUE';
      var user    = {
        email       : row[COL_USER.EMAIL],
        role        : row[COL_USER.ROLE],
        nama        : row[COL_USER.NAMA],
        aktif       : isAktif,
        ditambahAt  : row[COL_USER.DITAMBAH_AT]
                      ? new Date(row[COL_USER.DITAMBAH_AT]).toISOString() : null,
        ditambahOleh: row[COL_USER.DITAMBAH_OLEH],
        dicabutAt   : row[COL_USER.DICABUT_AT]
                      ? new Date(row[COL_USER.DICABUT_AT]).toISOString() : null,
        catatan     : row[COL_USER.CATATAN]
      };
      if (isAktif) {
        if (user.role === ROLES.ATASAN)      aktif.atasan.push(user);
        if (user.role === ROLES.OPERATOR)    aktif.operator.push(user);
        if (user.role === ROLES.ANGGOTA_TIM) aktif.anggotaTim.push(user);
      } else {
        tidakAktif.push(user);
      }
    }
    return { aktif: aktif, tidakAktif: tidakAktif };
  } catch (err) {
    throw new Error('getAllUsers gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 16. ADMINISTRASI
// ════════════════════════════════════════════════

function assignOperator(atasanEmail, operatorEmailBaru, operatorNama, catatan) {
  try {
    return tetapkanOperator(atasanEmail, operatorEmailBaru, operatorNama, catatan);
  } catch (err) {
    throw new Error('assignOperator gagal: ' + err.message);
  }
}

function issueAccessOrder(atasanEmail, targetEmail, targetNama, tindakan, roleTarget, alasan) {
  try {
    return terbitkanPerintahAkses(
      atasanEmail, targetEmail, targetNama, tindakan, roleTarget, alasan);
  } catch (err) {
    throw new Error('issueAccessOrder gagal: ' + err.message);
  }
}

/**
 * Evaluasi kepatuhan seluruh folder aktif.
 * Jalankan verifikasiMandiri untuk setiap folder berstatus SEDANG_DIKERJAKAN.
 * Juknis Bab X huruf A: minimal 1x per bulan.
 */
function jalankanEvaluasiKepatuhan(atasanEmail) {
  try {
    requireRole(atasanEmail, ROLES.ATASAN);

    var sheet  = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var data   = sheet.getDataRange().getValues();
    var hasil  = [];

    for (var i = 1; i < data.length; i++) {
      var row    = data[i];
      var id     = row[COL.ID];
      var status = row[COL.STATUS];

      if (!id) continue;
      if (row[COL.ENTRY_TYPE] === ENTRY_TYPE.HISTORIS) continue;
      if (status === STATUS.DITANGGUHKAN || status === STATUS.FINAL) continue;

      try {
        var cek = verifikasiMandiri(id);
        hasil.push({
          proposalId  : id,
          namaKarya   : row[COL.NAMA_KARYA],
          status      : status,
          siap        : cek.siap,
          itemGagal   : cek.itemGagal,
          itemLulus   : cek.itemLulus
        });
      } catch(e) {
        hasil.push({
          proposalId : id,
          namaKarya  : row[COL.NAMA_KARYA],
          status     : status,
          siap       : false,
          itemGagal  : ['Error evaluasi: ' + e.message],
          itemLulus  : []
        });
      }
    }

    writeAuditLog(ACTION_TYPES.ERROR,
      'Evaluasi kepatuhan dijalankan oleh Atasan: ' + atasanEmail +
      '. Total dievaluasi: ' + hasil.length + ' folder.', null);

    return hasil;
  } catch (err) {
    throw new Error('jalankanEvaluasiKepatuhan gagal: ' + err.message);
  }
}


function deleteProposal(requesterEmail, proposalId) {
  try {
    var role = requireRole(requesterEmail, [ROLES.OPERATOR]);
    
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');
    
    var row = hasil.rowData;
    var status = row[COL.STATUS];
    var folderKaryaId = row[COL.FOLDER_KARYA_ID];
    
    // Hanya bisa dihapus jika statusnya "Sedang Dikerjakan" atau "Diperbaiki" (draft)
    if (status !== STATUS.SEDANG_DIKERJAKAN && status !== STATUS.DIPERBAIKI) {
      throw new Error('Akses ditolak: Hanya usulan berstatus "Sedang Dikerjakan" atau "Diperbaiki" yang dapat dihapus.');
    }
    
    // 1. Pindahkan folder karya di Google Drive ke Trash
    if (folderKaryaId) {
      try {
        var folder = DriveApp.getFolderById(folderKaryaId);
        if (!folder.isTrashed()) {
          try {
            folder.setTrashed(true);
            Logger.log('Folder ' + folderKaryaId + ' berhasil dipindahkan ke trash.');
          } catch (trashErr) {
            // Fallback: Jika user bukan owner, putuskan hubungan dari parent folder
            var parents = folder.getParents();
            var removed = false;
            while (parents.hasNext()) {
              var parent = parents.next();
              try {
                parent.removeFolder(folder);
                removed = true;
                Logger.log('Folder ' + folderKaryaId + ' dilepaskan dari parent ' + parent.getName());
              } catch (removeErr) {
                Logger.log('Gagal melepaskan folder dari parent ' + parent.getName() + ': ' + removeErr.toString());
              }
            }
            if (!removed) {
              throw new Error('Bukan pemilik folder dan gagal melepaskan folder dari parent. Detail: ' + trashErr.toString());
            }
          }
        }
      } catch (driveErr) {
        var errMsg = driveErr.toString().toLowerCase();
        // Jika folder memang tidak ditemukan atau sudah dihapus, biarkan hapus spreadsheet jalan
        if (errMsg.indexOf("not found") !== -1 || errMsg.indexOf("tidak ditemukan") !== -1 || errMsg.indexOf("invalid id") !== -1) {
          Logger.log("Folder tidak ditemukan di Drive (ID: " + folderKaryaId + "), melanjutkan hapus spreadsheet.");
        } else {
          throw new Error('Gagal menghapus folder Google Drive (ID: ' + folderKaryaId + '). Detail: ' + driveErr.message);
        }
      }
    } else {
      Logger.log("Peringatan: folderKaryaId tidak ditemukan di spreadsheet untuk proposal " + proposalId);
    }
    
    // 2. Hapus baris dari Spreadsheet
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
      var hTx = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
      if (hTx) {
        sheetTx.deleteRow(hTx.rowIndex);
      }
    });
    
    writeAuditLog("STATUS_CHANGE",
      'Proposal ' + proposalId + ' (' + row[COL.NAMA_KARYA] + ') dihapus oleh ' + role + ' (' + requesterEmail + ').',
      proposalId);
      
    return { success: true, proposalId: proposalId };
  } catch (err) {
    throw new Error('deleteProposal gagal: ' + err.message);
  }
}

/**
 * Helper to safely move a file to trash on Google Drive, or remove it from parent folders if not the owner.
 */
function trashDriveFileSafely(fileId) {
  if (!fileId) return;
  try {
    var file;
    try {
      file = DriveApp.getFileById(fileId);
    } catch (notFoundErr) {
      Logger.log('File tidak ditemukan di Drive (sudah terhapus manual?): ' + fileId);
      return; // Anggap sukses karena file sudah tidak ada
    }
    
    if (!file.isTrashed()) {
      try {
        file.setTrashed(true);
        Logger.log('File ' + fileId + ' berhasil dipindahkan ke trash.');
      } catch (trashErr) {
        Logger.log('Gagal setTrashed (bukan owner?), mencoba remove dari parents: ' + trashErr.toString());
        var parents = file.getParents();
        var removed = false;
        while (parents.hasNext()) {
          var parent = parents.next();
          try {
            parent.removeFile(file);
            removed = true;
            Logger.log('File ' + fileId + ' berhasil dilepaskan dari parent ' + parent.getName());
          } catch (removeErr) {
            Logger.log('Gagal melepaskan file dari parent ' + parent.getName() + ': ' + removeErr.toString());
          }
        }
        if (!removed) {
          throw new Error('Tidak memiliki hak untuk memindahkan berkas ke trash dan gagal melepaskannya dari folder.');
        }
      }
    }
  } catch (err) {
    Logger.log('trashDriveFileSafely gagal untuk ' + fileId + ': ' + err.toString());
    throw new Error('Gagal memproses penghapusan berkas di Drive: ' + err.message);
  }
}


/**
 * Menghapus Google Docs formulir usulan aktif dan riwayat versinya.
 * Hanya bisa dilakukan oleh Operator saat status usulan sedang draf dan tidak dikunci.
 */
function deleteActiveFormulir(operatorEmail, proposalId) {
  try {
    var role = requireRole(operatorEmail, [ROLES.OPERATOR]);
    
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');
    
    var row = hasil.rowData;
    var status = row[COL.STATUS];
    var driveLocked = row[COL.DRIVE_LOCKED];
    var docActiveId = row[COL.DOC_ACTIVE_ID];
    
    if (status !== STATUS.SEDANG_DIKERJAKAN && status !== STATUS.DIPERBAIKI) {
      throw new Error('Akses ditolak: Hanya usulan berstatus "Sedang Dikerjakan" atau "Diperbaiki" yang dapat dimodifikasi.');
    }
    if (driveLocked) {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }
    
    // Trash active file
    trashDriveFileSafely(docActiveId);
    
    // Trash history files
    var docHistory = safeParseJSON(row[COL.DOC_HISTORY_JSON], {});
    for (var key in docHistory) {
      trashDriveFileSafely(docHistory[key]);
    }
    
    // Update database
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
      var hTx = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
      if (hTx) {
        sheetTx.getRange(hTx.rowIndex, COL.DOC_ACTIVE_ID + 1).setValue('');
        sheetTx.getRange(hTx.rowIndex, COL.DOC_HISTORY_JSON + 1).setValue(JSON.stringify({}));
        sheetTx.getRange(hTx.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
      }
    });
    
    writeAuditLog("STATUS_CHANGE",
      'Formulir usulan proposal ' + proposalId + ' dihapus oleh ' + role + ' (' + operatorEmail + ').',
      proposalId);
      
    return { success: true };
  } catch (err) {
    throw new Error('deleteActiveFormulir gagal: ' + err.message);
  }
}

/**
 * Menghapus satu file kajian ilmiah (PDF) dan di Google Drive serta membersihkannya dari database metadata.
 * Hanya bisa dilakukan oleh Operator saat status usulan sedang draf dan tidak dikunci.
 */
function deleteKajianFile(operatorEmail, proposalId, fileId) {
  try {
    var role = requireRole(operatorEmail, [ROLES.OPERATOR]);
    
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');
    
    var row = hasil.rowData;
    var status = row[COL.STATUS];
    var driveLocked = row[COL.DRIVE_LOCKED];
    var kajianFiles = safeParseJSON(row[COL.KAJIAN_FILES_JSON], []);
    
    if (status !== STATUS.SEDANG_DIKERJAKAN && status !== STATUS.DIPERBAIKI) {
      throw new Error('Akses ditolak: Hanya usulan berstatus "Sedang Dikerjakan" atau "Diperbaiki" yang dapat dimodifikasi.');
    }
    if (driveLocked) {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }
    
    var fileDitemukan = false;
    var updatedKajianFiles = kajianFiles.filter(function(f) {
      if (f.fileId === fileId) {
        fileDitemukan = true;
        trashDriveFileSafely(fileId);
        if (f.arsipFileId) {
          trashDriveFileSafely(f.arsipFileId);
        }
        return false;
      }
      return true;
    });
    
    if (!fileDitemukan) {
      throw new Error('File Kajian dengan ID tersebut tidak ditemukan.');
    }
    
    updateFileMetadata(proposalId, COL.KAJIAN_FILES_JSON, updatedKajianFiles);
    
    writeAuditLog("STATUS_CHANGE",
      'Kajian Ilmiah (File ID: ' + fileId + ') pada proposal ' + proposalId + ' dihapus oleh ' + role + ' (' + operatorEmail + ').',
      proposalId);
      
    return { success: true };
  } catch (err) {
    throw new Error('deleteKajianFile gagal: ' + err.message);
  }
}

/**
 * Menghapus satu file foto dokumentasi dan di Google Drive serta membersihkannya dari database metadata.
 * Hanya bisa dilakukan oleh Operator saat status usulan sedang draf dan tidak dikunci.
 */
function deleteFotoFile(operatorEmail, proposalId, fileId) {
  try {
    var role = requireRole(operatorEmail, [ROLES.OPERATOR]);
    
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');
    
    var row = hasil.rowData;
    var status = row[COL.STATUS];
    var driveLocked = row[COL.DRIVE_LOCKED];
    var fotoFiles = safeParseJSON(row[COL.FOTO_FILES_JSON], []);
    
    if (status !== STATUS.SEDANG_DIKERJAKAN && status !== STATUS.DIPERBAIKI) {
      throw new Error('Akses ditolak: Hanya usulan berstatus "Sedang Dikerjakan" atau "Diperbaiki" yang dapat dimodifikasi.');
    }
    if (driveLocked) {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }
    
    var fileDitemukan = false;
    var updatedFotoFiles = fotoFiles.filter(function(f) {
      if (f.fileId === fileId) {
        fileDitemukan = true;
        trashDriveFileSafely(fileId);
        if (f.arsipFileId) {
          trashDriveFileSafely(f.arsipFileId);
        }
        return false;
      }
      return true;
    });
    
    if (!fileDitemukan) {
      throw new Error('Foto dengan ID tersebut tidak ditemukan.');
    }
    
    updateFileMetadata(proposalId, COL.FOTO_FILES_JSON, updatedFotoFiles);
    
    writeAuditLog("STATUS_CHANGE",
      'Foto Dokumentasi (File ID: ' + fileId + ') pada proposal ' + proposalId + ' dihapus oleh ' + role + ' (' + operatorEmail + ').',
      proposalId);
      
    return { success: true };
  } catch (err) {
    throw new Error('deleteFotoFile gagal: ' + err.message);
  }
}

/**
 * Menghapus file .txt URL video dan mengosongkan kolom video_url di database.
 * Hanya bisa dilakukan oleh Operator saat status usulan sedang draf dan tidak dikunci.
 */
function deleteVideoUrl(operatorEmail, proposalId) {
  try {
    var role = requireRole(operatorEmail, [ROLES.OPERATOR]);
    
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');
    
    var row = hasil.rowData;
    var status = row[COL.STATUS];
    var driveLocked = row[COL.DRIVE_LOCKED];
    var folderIds = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var videoUrl = row[COL.VIDEO_URL];
    
    if (status !== STATUS.SEDANG_DIKERJAKAN && status !== STATUS.DIPERBAIKI) {
      throw new Error('Akses ditolak: Hanya usulan berstatus "Sedang Dikerjakan" atau "Diperbaiki" yang dapat dimodifikasi.');
    }
    if (driveLocked) {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }
    
    if (!videoUrl) {
      throw new Error('Belum ada video URL yang tersimpan.');
    }
    
    // Trash .txt file in Google Drive
    var folderPDId = folderIds['PENGUMPULAN_DATA'];
    if (folderPDId) {
      try {
        var folderPD = DriveApp.getFolderById(folderPDId);
        var iterVideo = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
        if (iterVideo.hasNext()) {
          var folderVideo = iterVideo.next();
          var iterFiles = folderVideo.getFiles();
          while (iterFiles.hasNext()) {
            var f = iterFiles.next();
            if (f.getMimeType() === 'text/plain') {
              trashDriveFileSafely(f.getId());
            }
          }
          var iterArsip = folderVideo.getFoldersByName(FOLDER_NAMES.JENIS.ARSIP_VERSI);
          if (iterArsip.hasNext()) {
            var folderArsip = iterArsip.next();
            var iterArsipFiles = folderArsip.getFiles();
            while (iterArsipFiles.hasNext()) {
              var af = iterArsipFiles.next();
              trashDriveFileSafely(af.getId());
            }
          }
        }
      } catch (driveErr) {
        Logger.log('Gagal menghapus file .txt video dari Drive: ' + driveErr.toString());
      }
    }
    
    // Update database
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
      var hTx = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
      if (hTx) {
        sheetTx.getRange(hTx.rowIndex, COL.VIDEO_URL + 1).setValue('');
        sheetTx.getRange(hTx.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
      }
    });
    
    writeAuditLog("STATUS_CHANGE",
      'Video URL (URL: ' + videoUrl + ') pada proposal ' + proposalId + ' dihapus oleh ' + role + ' (' + operatorEmail + ').',
      proposalId);
      
    return { success: true };
  } catch (err) {
    throw new Error('deleteVideoUrl gagal: ' + err.message);
  }
}



/**
 * Menandai apakah revisi usulan telah selesai dikerjakan oleh Anggota Tim.
 */
function setRevisiSelesai(requesterEmail, proposalId, isSelesai) {
  try {
    var role = requireRole(requesterEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR]);
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal \'' + proposalId + '\' tidak ditemukan.');
    
    if (role === ROLES.ANGGOTA_TIM && hasil.rowData[COL.PENANGGUNG_JAWAB_EMAIL] !== requesterEmail) {
      throw new Error('Akses ditolak: Anda bukan penanggung jawab usulan ini.');
    }
    
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(s) {
      var h = DatabaseEngine.findRow(s, COL.ID, proposalId);
      s.getRange(h.rowIndex, COL.IS_REVISI_SELESAI + 1).setValue(isSelesai);
      s.getRange(h.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
    });
    
    writeAuditLog(
      ACTION_TYPES.STATUS_CHANGE,
      "Status revisi selesai diset ke " + isSelesai + " oleh " + requesterEmail,
      proposalId
    );
    
    return { success: true };
  } catch (err) {
    throw new Error('setRevisiSelesai gagal: ' + err.message);
  }
}



// ════════════════════════════════════════════════
// 17. HELPER UTILITIES
// ════════════════════════════════════════════════

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}