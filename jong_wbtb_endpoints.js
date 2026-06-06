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
    .createTemplateFromFile('jong_wbtb_frontend')
    .evaluate()
    .setTitle('JONG WBTb — Sistem Pengelolaan WBTb')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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

      var isHistoris = (row[COL.ENTRY_TYPE] === ENTRY_TYPE.HISTORIS);
      var status = row[COL.STATUS];

      if (isHistoris) {
        // Arsip historis yang berstatus Final (Ditetapkan) tetap dihitung sebagai WBTb resmi
        if (status === STATUS.FINAL) {
          metrics.final++;
        }
        continue;
      }

      metrics.total++;
      if (status === STATUS.SEDANG_DIKERJAKAN) metrics.dikerjakan++;
      if (status === STATUS.DIPERBAIKI)         metrics.revisi++;
      if (status === STATUS.FINAL)              metrics.final++;
      if (status === STATUS.DITANGGUHKAN)       metrics.ditangguhkan++;

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
    folderIds            : safeParseJSON(row[COL.FOLDER_IDS_JSON], {}),
    driveLocked          : row[COL.DRIVE_LOCKED],
    isApprovedByAtasan   : row[COL.IS_APPROVED_BY_ATASAN] === true || row[COL.IS_APPROVED_BY_ATASAN] === 'TRUE',
    isRevisiSelesai      : row[COL.IS_REVISI_SELESAI] === true || row[COL.IS_REVISI_SELESAI] === 'TRUE',
    createdAt            : row[COL.CREATED_AT]
                           ? new Date(row[COL.CREATED_AT]).toISOString() : null,
    updatedAt            : row[COL.UPDATED_AT]
                           ? new Date(row[COL.UPDATED_AT]).toISOString()  : null,
    judulSingkat         : row[COL.JUDUL_SINGKAT],
    catatanAtasan        : row[COL.CATATAN_ATASAN],
    docActiveId          : row[COL.DOC_ACTIVE_ID],
    kajianFiles          : safeParseJSON(row[COL.KAJIAN_FILES_JSON], []),
    fotoFiles            : safeParseJSON(row[COL.FOTO_FILES_JSON], []),
    videoUrl             : row[COL.VIDEO_URL] || "",
    presentasiFiles      : safeParseJSON(row[COL.PRESENTASI_FILES_JSON], []),
    sertifikatFiles      : safeParseJSON(row[COL.SERTIFIKAT_FILES_JSON], [])
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

    var sheetUser = DatabaseEngine.getSheet(DB_USERS);
    var hasilPJ   = DatabaseEngine.findRow(sheetUser, COL_USER.EMAIL,
      data.penanggungJawabEmail);
    var pjNama    = hasilPJ ? hasilPJ.rowData[COL_USER.NAMA] : data.penanggungJawabEmail;

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
      rowData[COL.PRESENTASI_FILES_JSON]  = JSON.stringify([]);
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

    var kajianFiles    = safeParseJSON(row[COL.KAJIAN_FILES_JSON],    []);
    var fotoFiles      = safeParseJSON(row[COL.FOTO_FILES_JSON],      []);
    var catatanPenilai = safeParseJSON(row[COL.CATATAN_PENILAI_JSON], []);
    var docHistory     = safeParseJSON(row[COL.DOC_HISTORY_JSON],     {});
    var folderIds      = safeParseJSON(row[COL.FOLDER_IDS_JSON],      {});
    var presentasiFiles = safeParseJSON(row[COL.PRESENTASI_FILES_JSON], []);
    var sertifikatFiles = safeParseJSON(row[COL.SERTIFIKAT_FILES_JSON], []);

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
      presentasiFiles      : presentasiFiles.filter(function(f) { return f.status==='aktif'; }),
      sertifikatFiles      : sertifikatFiles.filter(function(f) { return f.status==='aktif'; }),
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
  var folderKaryaId = null;
  var pjEmail = null;
  
  try {
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) return;
    folderKaryaId = hasil.rowData[COL.FOLDER_KARYA_ID];
    pjEmail       = hasil.rowData[COL.PENANGGUNG_JAWAB_EMAIL];
  } catch (dbReadErr) {
    Logger.log('kunciFolderDrive DB read error: ' + dbReadErr.toString());
    return;
  }

  var driveSuccess = false;
  if (folderKaryaId && pjEmail) {
    try {
      var folder = DriveApp.getFolderById(folderKaryaId);
      folder.removeEditor(pjEmail);
      folder.addViewer(pjEmail);
      kunciFolderRekursif(folder, pjEmail);
      driveSuccess = true;
    } catch (driveErr) {
      Logger.log('kunciFolderDrive DriveApp error (lanjut update DB): ' + driveErr.toString());
    }
  }

  try {
    DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheetTx) {
      var h = DatabaseEngine.findRow(sheetTx, COL.ID, proposalId);
      if (h) {
        sheetTx.getRange(h.rowIndex, COL.DRIVE_LOCKED + 1).setValue(true);
        sheetTx.getRange(h.rowIndex, COL.UPDATED_AT + 1).setValue(new Date());
      }
    });

    writeAuditLog(ACTION_TYPES.DRIVE_ACCESS_FROZEN,
      'Folder dikunci secara administratif' + (driveSuccess ? ' & fisik Drive.' : ' (gagal kunci fisik Drive).') + ' PJ: ' + pjEmail,
      proposalId);
  } catch (dbWriteErr) {
    Logger.log('kunciFolderDrive DB write error: ' + dbWriteErr.toString());
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
    var role = requireRole(anggotaEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR]);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row           = hasil.rowData;
    var status        = row[COL.STATUS];
    var driveLocked   = row[COL.DRIVE_LOCKED];
    var pjEmail       = row[COL.PENANGGUNG_JAWAB_EMAIL];

    if (role === ROLES.ANGGOTA_TIM && pjEmail.toLowerCase() !== anggotaEmail.toLowerCase()) {
      throw new Error('Akses ditolak: Anda bukan penanggung jawab usulan ini.');
    }
    if (status === STATUS.FINAL || status === STATUS.DITANGGUHKAN) {
      throw new Error('Akses ditolak: Usulan berstatus Final atau Ditangguhkan tidak dapat dimodifikasi.');
    }
    if (driveLocked === true || driveLocked === 'TRUE') {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }

    var judulSingkat  = row[COL.JUDUL_SINGKAT];
    var namaKarya     = row[COL.NAMA_KARYA];
    var folderIds     = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var folderPDId    = folderIds['PENGUMPULAN_DATA'];

    if (!folderPDId) throw new Error('Folder Pengumpulan Data tidak ditemukan.');
    if (row[COL.DOC_ACTIVE_ID]) throw new Error('Formulir sudah ada. Gunakan Naik Versi untuk membuat versi baru.');

    var folderPD       = DriveApp.getFolderById(folderPDId);
    var iterFormulir   = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.FORMULIR_USULAN);
    if (!iterFormulir.hasNext()) throw new Error('Subfolder FORMULIR-USULAN tidak ditemukan.');
    var folderFormulir = iterFormulir.next();

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
    var role = requireRole(anggotaEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR]);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row          = hasil.rowData;
    var status        = row[COL.STATUS];
    var driveLocked   = row[COL.DRIVE_LOCKED];
    var pjEmail       = row[COL.PENANGGUNG_JAWAB_EMAIL];

    if (role === ROLES.ANGGOTA_TIM && pjEmail.toLowerCase() !== anggotaEmail.toLowerCase()) {
      throw new Error('Akses ditolak: Anda bukan penanggung jawab usulan ini.');
    }
    if (status === STATUS.FINAL || status === STATUS.DITANGGUHKAN) {
      throw new Error('Akses ditolak: Usulan berstatus Final atau Ditangguhkan tidak dapat dimodifikasi.');
    }
    if (driveLocked === true || driveLocked === 'TRUE') {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }

    var docActiveId  = row[COL.DOC_ACTIVE_ID];
    var judulSingkat = row[COL.JUDUL_SINGKAT];
    var folderIds    = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var docHistory   = safeParseJSON(row[COL.DOC_HISTORY_JSON], {});
    var versiKeys    = Object.keys(docHistory);
    var versiLama    = versiKeys.length;

    if (!docActiveId) throw new Error('Belum ada formulir aktif.');

    var folderPDId    = folderIds['PENGUMPULAN_DATA'];
    var folderPD      = DriveApp.getFolderById(folderPDId);
    var iterFormulir  = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.FORMULIR_USULAN);
    if (!iterFormulir.hasNext()) throw new Error('Folder FORMULIR-USULAN tidak ditemukan.');
    var folderFormulirId = iterFormulir.next().getId();

    var hasilArsip = arsipFormulirVersi(
      proposalId, folderFormulirId, docActiveId, versiLama, anggotaEmail
    );

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
    var role = requireRole(anggotaEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR]);

    var validasi = validateFilePDF(fileMeta);
    if (!validasi.valid) throw new Error(validasi.pesan);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row           = hasil.rowData;
    var status        = row[COL.STATUS];
    var driveLocked   = row[COL.DRIVE_LOCKED];
    var pjEmail       = row[COL.PENANGGUNG_JAWAB_EMAIL];

    if (role === ROLES.ANGGOTA_TIM && pjEmail.toLowerCase() !== anggotaEmail.toLowerCase()) {
      throw new Error('Akses ditolak: Anda bukan penanggung jawab usulan ini.');
    }
    if (status === STATUS.FINAL || status === STATUS.DITANGGUHKAN) {
      throw new Error('Akses ditolak: Usulan berstatus Final atau Ditangguhkan tidak dapat dimodifikasi.');
    }
    if (driveLocked === true || driveLocked === 'TRUE') {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }
    var judulSingkat  = row[COL.JUDUL_SINGKAT];
    var revisiRound   = parseInt(row[COL.REVISI_ROUND] || '0', 10);
    var folderIds     = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var kajianFiles   = safeParseJSON(row[COL.KAJIAN_FILES_JSON], []);

    var folderTahapId = folderIds['PENGUMPULAN_DATA'];
    if (revisiRound > 0 && row[COL.STATUS] === STATUS.DIPERBAIKI) {
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
      var folderPD   = DriveApp.getFolderById(folderTahapId);
      var iterKajian = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.KAJIAN_ILMIAH);
      if (iterKajian.hasNext()) folderTahapId = iterKajian.next().getId();
    }

    if (fileMeta.gantiFileId) {
      arsipKajianFile(proposalId, folderTahapId, fileMeta.gantiFileId, anggotaEmail);
      kajianFiles = tandaiFileDiarsip(kajianFiles, fileMeta.gantiFileId,
        fileMeta.gantiFileId);
    }

    var nomorUrut    = kajianFiles.filter(function(f) { return f.status==='aktif'; }).length + 1;
    var versi        = fileMeta.gantiFileId
      ? (kajianFiles.find(function(f) { return f.fileId===fileMeta.gantiFileId; }) || {versi:0}).versi + 1
      : 1;

    var jenisDok  = revisiRound > 0 ? JENIS_DOK.KAJIAN_REVISI : JENIS_DOK.KAJIAN;
    var params    = revisiRound > 0
      ? { putaran: revisiRound, nomorUrut: nomorUrut }
      : { nomorUrut: nomorUrut };
    var namaFileKajian = namaFile(jenisDok, judulSingkat, params);

    var base64Data = fileMeta.base64.indexOf(',') !== -1
      ? fileMeta.base64.split(',')[1] : fileMeta.base64;
    var blob    = Utilities.newBlob(
      Utilities.base64Decode(base64Data), fileMeta.mimeType, namaFileKajian + '.pdf');
    var folder  = DriveApp.getFolderById(folderTahapId);
    var file    = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingErr) {
      Logger.log('Warning: gagal setSharing untuk kajian: ' + sharingErr.toString());
    }

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
    var role = requireRole(anggotaEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR]);

    var validasiTotal = validateTotalPayload(payload.files);
    if (!validasiTotal.valid) throw new Error(validasiTotal.pesan);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row          = hasil.rowData;
    var status        = row[COL.STATUS];
    var driveLocked   = row[COL.DRIVE_LOCKED];
    var pjEmail       = row[COL.PENANGGUNG_JAWAB_EMAIL];

    if (role === ROLES.ANGGOTA_TIM && pjEmail.toLowerCase() !== anggotaEmail.toLowerCase()) {
      throw new Error('Akses ditolak: Anda bukan penanggung jawab usulan ini.');
    }
    if (status === STATUS.FINAL || status === STATUS.DITANGGUHKAN) {
      throw new Error('Akses ditolak: Usulan berstatus Final atau Ditangguhkan tidak dapat dimodifikasi.');
    }
    if (driveLocked === true || driveLocked === 'TRUE') {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }
    var judulSingkat = row[COL.JUDUL_SINGKAT];
    var revisiRound  = parseInt(row[COL.REVISI_ROUND] || '0', 10);
    var folderIds    = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var fotoFiles    = safeParseJSON(row[COL.FOTO_FILES_JSON], []);

    var folderTahapId = folderIds['PENGUMPULAN_DATA'];
    var folderPD      = DriveApp.getFolderById(folderTahapId);
    var iterFoto      = folderPD.getFoldersByName(FOLDER_NAMES.JENIS.FOTO_DOKUMENTASI);
    var folderFotoId  = iterFoto.hasNext() ? iterFoto.next().getId() : folderTahapId;

    if (payload.gantiFileId) {
      arsipFotoFile(proposalId, folderFotoId, payload.gantiFileId, anggotaEmail);
      fotoFiles = tandaiFileDiarsip(fotoFiles, payload.gantiFileId, payload.gantiFileId);
    }

    var hasilUpload = [];
    var nomorBase   = fotoFiles.filter(function(f) { return f.status==='aktif'; }).length;

    payload.files.forEach(function(fileMeta, idx) {
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

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingErr) {
        Logger.log('Warning: gagal setSharing untuk foto: ' + sharingErr.toString());
      }

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
    var role = requireRole(anggotaEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR]);

    var validasi = validateVideoUrl(url);
    if (!validasi.valid) throw new Error(validasi.pesan);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row           = hasil.rowData;
    var status        = row[COL.STATUS];
    var driveLocked   = row[COL.DRIVE_LOCKED];
    var pjEmail       = row[COL.PENANGGUNG_JAWAB_EMAIL];

    if (role === ROLES.ANGGOTA_TIM && pjEmail.toLowerCase() !== anggotaEmail.toLowerCase()) {
      throw new Error('Akses ditolak: Anda bukan penanggung jawab usulan ini.');
    }
    if (status === STATUS.FINAL || status === STATUS.DITANGGUHKAN) {
      throw new Error('Akses ditolak: Usulan berstatus Final atau Ditangguhkan tidak dapat dimodifikasi.');
    }
    if (driveLocked === true || driveLocked === 'TRUE') {
      throw new Error('Akses ditolak: Folder terkunci. Tidak dapat mengubah komponen.');
    }
    var namaKarya     = row[COL.NAMA_KARYA];
    var folderIds     = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var fileIdLama    = null;

    var videoUrl = row[COL.VIDEO_URL];
    if (videoUrl) {
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

    var judulSingkat = row[COL.JUDUL_SINGKAT];
    var folderPDId2  = folderIds['PENGUMPULAN_DATA'];
    var folderPD2    = DriveApp.getFolderById(folderPDId2);
    var iterVideo2   = folderPD2.getFoldersByName(FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
    var folderVideoId = iterVideo2.hasNext() ? iterVideo2.next().getId() : folderPDId2;

    var nomorUrut = 1;
    arsipVideoUrl(proposalId, judulSingkat, folderVideoId, fileIdLama,
      url, keterangan, nomorUrut, anggotaEmail);

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
    requireRole(requesterEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR]);
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
// 14. LOG AKTIVITAS
// ════════════════════════════════════════════════

function getLogAktivitas(requesterEmail, halaman, perHalaman, filterAction, filterSearch) {
  try {
    requireRole(requesterEmail, [ROLES.OPERATOR, ROLES.ATASAN]);
    var sheet  = DatabaseEngine.getSheet(DB_NAMES.ACTIVITY_LOG);
    var data   = sheet.getDataRange().getValues();
    var rows   = data.slice(1).reverse();

    // ── Server-side filtering ──────────────────
    var filteredRows = rows.filter(function(row) {
      var actionType = (row[COL_LOG.ACTION_TYPE] || '').toString();
      var userEmail  = (row[COL_LOG.USER_EMAIL] || '').toString().toLowerCase();
      var proposalId = (row[COL_LOG.PROPOSAL_ID] || '').toString().toLowerCase();
      var detail     = (row[COL_LOG.DETAIL] || '').toString().toLowerCase();

      var matchAction = true;
      if (filterAction) {
        if (filterAction === 'STATUS_CHANGE') {
          matchAction = (actionType === 'STATUS_CHANGE');
        } else if (filterAction === 'WORKSPACE_INIT') {
          matchAction = actionType.indexOf('WORKSPACE_INIT') !== -1 || actionType.indexOf('HISTORIS_INIT') !== -1;
        } else if (filterAction === 'DOKUMEN') {
          matchAction = actionType.indexOf('FORMULIR') !== -1 || actionType.indexOf('KAJIAN') !== -1 || 
                        actionType.indexOf('FOTO') !== -1 || actionType.indexOf('VIDEO') !== -1 || 
                        actionType.indexOf('SERTIFIKAT') !== -1 || actionType.indexOf('PRESENTASI') !== -1 || 
                        actionType.indexOf('SERTOR') !== -1;
        } else if (filterAction === 'CATATAN') {
          matchAction = actionType.indexOf('CATATAN') !== -1 || actionType.indexOf('REVISI') !== -1;
        } else if (filterAction === 'AKSES') {
          matchAction = actionType.indexOf('AKSES') !== -1;
        } else if (filterAction === 'DRIVE') {
          matchAction = actionType.indexOf('DRIVE') !== -1;
        } else if (filterAction === 'HISTORIS') {
          matchAction = actionType.indexOf('HISTORIS') !== -1 || actionType.indexOf('ARSIP') !== -1;
        } else if (filterAction === 'EVALUASI') {
          matchAction = actionType.indexOf('EVALUASI') !== -1 || actionType.indexOf('RETENSI') !== -1;
        } else if (filterAction === 'ERROR') {
          matchAction = actionType.indexOf('ERROR') !== -1;
        }
      }

      var matchQuery = true;
      if (filterSearch) {
        var q = filterSearch.toLowerCase().trim();
        matchQuery = userEmail.indexOf(q) !== -1 || 
                     proposalId.indexOf(q) !== -1 || 
                     detail.indexOf(q) !== -1 ||
                     actionType.toLowerCase().indexOf(q) !== -1;
      }

      return matchAction && matchQuery;
    });

    var limit  = perHalaman || 15;
    var page   = halaman || 1;
    var sliced = filteredRows.slice((page-1)*limit, page*limit);

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
      totalHalaman : Math.max(1, Math.ceil(filteredRows.length / limit)),
      halamanAktif : page,
      totalLog     : filteredRows.length
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

    writeAuditLog(ACTION_TYPES.EVALUASI_KEPATUHAN,
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
      return;
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
    
    trashDriveFileSafely(docActiveId);
    
    var docHistory = safeParseJSON(row[COL.DOC_HISTORY_JSON], {});
    for (var key in docHistory) {
      trashDriveFileSafely(docHistory[key]);
    }
    
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
    
    if (role === ROLES.ANGGOTA_TIM && hasil.rowData[COL.PENANGGUNG_JAWAB_EMAIL].toLowerCase() !== requesterEmail.toLowerCase()) {
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
// 16b. PRESENTASI & SERTIFIKAT MANAGEMENT
// ════════════════════════════════════════════════

/**
 * Upload berkas presentasi (PPT/PPTX/PDF).
 */
function uploadPresentasi(email, proposalId, fileMeta) {
  try {
    var role = requireRole(email, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR]);
    
    var validasi = validateFilePresentasi(fileMeta);
    if (!validasi.valid) throw new Error(validasi.pesan);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row = hasil.rowData;
    if (role === ROLES.ANGGOTA_TIM && row[COL.PENANGGUNG_JAWAB_EMAIL].toLowerCase() !== email.toLowerCase()) {
      throw new Error('Akses ditolak: Anda bukan penanggung jawab usulan ini.');
    }

    if (row[COL.STATUS] === STATUS.FINAL || row[COL.STATUS] === STATUS.DITANGGUHKAN) {
      throw new Error('Akses ditolak: Usulan berstatus Final atau Ditangguhkan tidak dapat dimodifikasi.');
    }

    var folderIds = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var presentasiFiles = safeParseJSON(row[COL.PRESENTASI_FILES_JSON], []);

    var activeStage = getActiveStageKey(row[COL.STATUS], parseInt(row[COL.REVISI_ROUND] || '0', 10), row[COL.IS_APPROVED_BY_ATASAN] === true || row[COL.IS_APPROVED_BY_ATASAN] === 'TRUE');
    var parentFolderId = folderIds[activeStage];
    if (!parentFolderId) throw new Error('Folder ID untuk tahap aktif tidak ditemukan.');

    var parentFolder = DriveApp.getFolderById(parentFolderId);
    var folderPres = getOrCreateFolder(parentFolder, 'PRESENTASI');
    var folderPresId = folderPres.getId();

    if (fileMeta.gantiFileId) {
      var fileLama = DriveApp.getFileById(fileMeta.gantiFileId);
      var folderArsip = getOrCreateFolder(folderPres, FOLDER_NAMES.JENIS.ARSIP_VERSI);
      fileLama.moveTo(folderArsip);
      presentasiFiles = tandaiFileDiarsip(presentasiFiles, fileMeta.gantiFileId, fileMeta.gantiFileId);
    }

    var versi = fileMeta.gantiFileId
      ? (presentasiFiles.find(function(f) { return f.fileId === fileMeta.gantiFileId; }) || {versi:0}).versi + 1
      : 1;

    var judulSingkat = row[COL.JUDUL_SINGKAT];
    var namaFilePres = namaPresentasi(judulSingkat, versi);
    var ext = fileMeta.mimeType === 'application/pdf' ? '.pdf' : (fileMeta.mimeType === 'application/vnd.ms-powerpoint' ? '.ppt' : '.pptx');

    var base64Data = fileMeta.base64.indexOf(',') !== -1 ? fileMeta.base64.split(',')[1] : fileMeta.base64;
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileMeta.mimeType, namaFilePres + ext);
    var file = folderPres.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingErr) {
      Logger.log('Warning: gagal setSharing untuk presentasi: ' + sharingErr.toString());
    }

    var newMeta = buildFileMetadata(file.getId(), namaFilePres + ext, versi, email);
    presentasiFiles.push(newMeta);
    updateFileMetadata(proposalId, COL.PRESENTASI_FILES_JSON, presentasiFiles);

    writeAuditLog("PRESENTASI_UPLOAD", 'Presentasi diunggah: ' + namaFilePres + ext + '. File ID: ' + file.getId(), proposalId);

    return { fileId: file.getId(), namaFile: namaFilePres + ext };
  } catch (err) {
    throw new Error('uploadPresentasi gagal: ' + err.message);
  }
}

/**
 * Hapus berkas presentasi.
 */
function deletePresentasiFile(email, proposalId, fileId) {
  try {
    var role = requireRole(email, [ROLES.OPERATOR, ROLES.ANGGOTA_TIM]);
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row = hasil.rowData;
    if (role === ROLES.ANGGOTA_TIM && row[COL.PENANGGUNG_JAWAB_EMAIL].toLowerCase() !== email.toLowerCase()) {
      throw new Error('Akses ditolak: Anda bukan penanggung jawab usulan ini.');
    }

    if (row[COL.STATUS] === STATUS.FINAL || row[COL.STATUS] === STATUS.DITANGGUHKAN) {
      throw new Error('Akses ditolak: Usulan berstatus Final atau Ditangguhkan tidak dapat dimodifikasi.');
    }

    var presentasiFiles = safeParseJSON(row[COL.PRESENTASI_FILES_JSON], []);
    var fileDitemukan = false;
    var updatedFiles = presentasiFiles.filter(function(f) {
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

    if (!fileDitemukan) throw new Error('File Presentasi tidak ditemukan.');

    updateFileMetadata(proposalId, COL.PRESENTASI_FILES_JSON, updatedFiles);
    writeAuditLog("STATUS_CHANGE", 'File Presentasi (ID: ' + fileId + ') dihapus oleh ' + email, proposalId);
    return { success: true };
  } catch (err) {
    throw new Error('deletePresentasiFile gagal: ' + err.message);
  }
}

/**
 * Upload berkas sertifikat/SK (PDF).
 */
function uploadSertifikat(email, proposalId, fileMeta) {
  try {
    requireRole(email, [ROLES.OPERATOR]);
    
    var validasi = validateFilePDF(fileMeta);
    if (!validasi.valid) throw new Error(validasi.pesan);

    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var row = hasil.rowData;
    var folderIds = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
    var sertifikatFiles = safeParseJSON(row[COL.SERTIFIKAT_FILES_JSON], []);

    var finalFolderId = folderIds['FINAL'];
    if (!finalFolderId) throw new Error('Folder ID untuk tahap FINAL tidak ditemukan.');

    var finalFolder = DriveApp.getFolderById(finalFolderId);
    var folderSert = getOrCreateFolder(finalFolder, 'SERTIFIKAT');

    var judulSingkat = row[COL.JUDUL_SINGKAT];
    var tahun = row[COL.TAHUN_USULAN];
    var namaFileSert = namaSertifikat(judulSingkat, tahun);

    sertifikatFiles.forEach(function(f) {
      trashDriveFileSafely(f.fileId);
    });
    sertifikatFiles = [];

    var base64Data = fileMeta.base64.indexOf(',') !== -1 ? fileMeta.base64.split(',')[1] : fileMeta.base64;
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileMeta.mimeType, namaFileSert + '.pdf');
    var file = folderSert.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingErr) {
      Logger.log('Warning: gagal setSharing untuk sertifikat: ' + sharingErr.toString());
    }

    var newMeta = buildFileMetadata(file.getId(), namaFileSert + '.pdf', 1, email);
    sertifikatFiles.push(newMeta);
    updateFileMetadata(proposalId, COL.SERTIFIKAT_FILES_JSON, sertifikatFiles);

    writeAuditLog("SERTOR_UPLOAD", 'Sertifikat diunggah: ' + namaFileSert + '.pdf. File ID: ' + file.getId(), proposalId);

    return { fileId: file.getId(), namaFile: namaFileSert + '.pdf' };
  } catch (err) {
    throw new Error('uploadSertifikat gagal: ' + err.message);
  }
}

/**
 * Hapus berkas sertifikat.
 */
function deleteSertifikatFile(email, proposalId, fileId) {
  try {
    requireRole(email, [ROLES.OPERATOR]);
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
    if (!hasil) throw new Error('Proposal tidak ditemukan.');

    var sertifikatFiles = safeParseJSON(hasil.rowData[COL.SERTIFIKAT_FILES_JSON], []);
    var fileDitemukan = false;
    var updatedFiles = sertifikatFiles.filter(function(f) {
      if (f.fileId === fileId) {
        fileDitemukan = true;
        trashDriveFileSafely(fileId);
        return false;
      }
      return true;
    });

    if (!fileDitemukan) throw new Error('File Sertifikat tidak ditemukan.');

    updateFileMetadata(proposalId, COL.SERTIFIKAT_FILES_JSON, updatedFiles);
    writeAuditLog("STATUS_CHANGE", 'File Sertifikat (ID: ' + fileId + ') dihapus oleh ' + email, proposalId);
    return { success: true };
  } catch (err) {
    throw new Error('deleteSertifikatFile gagal: ' + err.message);
  }
}


// ════════════════════════════════════════════════
// 17. HELPER UTILITIES
// ════════════════════════════════════════════════

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}

// ─────────────────────────────────────────────
// 18. DIAGNOSTIC UTILITIES FOR DEVELOPER
// ─────────────────────────────────────────────

function runDebugProposal() {
  debugProposalFiles("WBTB-001");
}

function debugProposalFiles(proposalId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(DB_NAMES.WBTB_LINGGA);
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var rowData = null;
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COL.ID]).toUpperCase() === String(proposalId).toUpperCase()) {
        rowIndex = i + 1;
        rowData = data[i];
        break;
      }
    }
    
    if (rowIndex === -1) {
      Logger.log("Proposal ID '" + proposalId + "' tidak ditemukan.");
      return;
    }
    
    Logger.log("=== DIAGNOSIS PROPOSAL '" + proposalId + "' ===");
    Logger.log("Row Index: " + rowIndex);
    Logger.log("Status: " + rowData[COL.STATUS]);
    Logger.log("Judul Singkat: " + rowData[COL.JUDUL_SINGKAT]);
    
    var kajianJson = rowData[COL.KAJIAN_FILES_JSON];
    var presJson = rowData[COL.PRESENTASI_FILES_JSON];
    var sertJson = rowData[COL.SERTIFIKAT_FILES_JSON];
    
    Logger.log("KAJIAN_FILES_JSON: " + kajianJson);
    Logger.log("PRESENTASI_FILES_JSON: " + presJson);
    Logger.log("SERTIFIKAT_FILES_JSON: " + sertJson);
    
    var listKajian = safeParseJSON(kajianJson, []);
    var listPres = safeParseJSON(presJson, []);
    var listSert = safeParseJSON(sertJson, []);
    
    Logger.log("--- Detail Kajian Ilmiah di Drive ---");
    listKajian.forEach(function(f, idx) {
      Logger.log("Kajian [" + idx + "]: fileId=" + f.fileId + ", name=" + f.name + ", status=" + f.status);
      checkDriveFileInfo(f.fileId);
    });
    
    Logger.log("--- Detail Berkas Presentasi di Drive ---");
    listPres.forEach(function(f, idx) {
      Logger.log("Presentasi [" + idx + "]: fileId=" + f.fileId + ", name=" + f.name + ", status=" + f.status);
      checkDriveFileInfo(f.fileId);
    });

    Logger.log("--- Detail Sertifikat di Drive ---");
    listSert.forEach(function(f, idx) {
      Logger.log("Sertifikat [" + idx + "]: fileId=" + f.fileId + ", name=" + f.name + ", status=" + f.status);
      checkDriveFileInfo(f.fileId);
    });
    
  } catch (err) {
    Logger.log("Error diagnosis: " + err.toString());
  }
}

function checkDriveFileInfo(fileId) {
  if (!fileId) {
    Logger.log("  - ERROR: File ID kosong");
    return;
  }
  try {
    var file = DriveApp.getFileById(fileId);
    Logger.log("  - File ditemukan!");
    Logger.log("  - Nama di Drive: " + file.getName());
    Logger.log("  - Ukuran: " + file.getSize() + " bytes");
    Logger.log("  - MIME Type: " + file.getMimeType());
    Logger.log("  - Access: " + file.getSharingAccess().toString());
    Logger.log("  - Permission: " + file.getSharingPermission().toString());
    Logger.log("  - Owner: " + file.getOwner().getEmail());
    
    var parents = file.getParents();
    while (parents.hasNext()) {
      var p = parents.next();
      Logger.log("  - Folder Induk: " + p.getName() + " (ID: " + p.getId() + ")");
    }
  } catch (e) {
    Logger.log("  - ERROR mengakses file: " + e.toString());
  }
}

// ════════════════════════════════════════════════
// 12. ARSIP HISTORIS
// ════════════════════════════════════════════════

function getArsipHistoris(requesterEmail) {
  try {
    // Semua user (Atasan, Operator, Anggota Tim) bisa melihat arsip historis
    var role = requireRole(requesterEmail, [ROLES.ANGGOTA_TIM, ROLES.OPERATOR, ROLES.ATASAN]);
    
    var sheet = DatabaseEngine.getSheet(DB_NAMES.WBTB_LINGGA);
    var data  = sheet.getDataRange().getValues();
    var arsip = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[COL.ID]) continue;
      
      // 1. Usulan yang berasal dari import (ENTRY_TYPE.HISTORIS)
      // 2. Usulan normal yang sudah mencapai status FINAL atau DITANGGUHKAN
      var isHistorisType = (row[COL.ENTRY_TYPE] === ENTRY_TYPE.HISTORIS);
      var isFinalOrTangguh = (row[COL.STATUS] === STATUS.FINAL || row[COL.STATUS] === STATUS.DITANGGUHKAN);
      
      if (isHistorisType || isFinalOrTangguh) {
        arsip.push(buatProposalSummary(row));
      }
    }
    
    arsip.sort(function(a, b) {
      if (b.tahunUsulan !== a.tahunUsulan) {
        return (parseInt(b.tahunUsulan) || 0) - (parseInt(a.tahunUsulan) || 0);
      }
      var nameA = a.namaKarya ? a.namaKarya.toLowerCase() : "";
      var nameB = b.namaKarya ? b.namaKarya.toLowerCase() : "";
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
    
    return { success: true, data: arsip };
  } catch (err) {
    Logger.log("getArsipHistoris error: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

function importArsipHistoris(requesterEmail, form) {
  try {
    // Hanya Operator yang boleh import arsip
    var role = requireRole(requesterEmail, [ROLES.OPERATOR]);
    
    if (!form.namaKarya || !form.judulSingkat || !form.domain || !form.tahunPenetapan || !form.status) {
      throw new Error("Nama Karya, Judul Singkat, Domain, Tahun, dan Status wajib diisi.");
    }

    var validasiJudul = validateJudulSingkat(form.judulSingkat);
    if (!validasiJudul.valid) throw new Error(validasiJudul.pesan);
    
    return DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
      var proposalId = generateProposalId(sheet);
      
      // 1. Buat folder arsip (struktur khusus untuk historis)
      var folderResult = initProposalWorkspace(proposalId, form.namaKarya, ENTRY_TYPE.HISTORIS, form.status);
      var folderIds = folderResult.folderIds;
      var stageKey = (form.status === STATUS.DITANGGUHKAN) ? "ARSIP_DITANGGUHKAN" : "FINAL";
      var stageFolderId = folderIds[stageKey];
      var stageFolder = DriveApp.getFolderById(stageFolderId);
      
      var docActiveId = "";
      var docHistoryJson = {};
      var kajianFiles = [];
      var fotoFiles = [];
      var presentasiFiles = [];
      var sertifikatFiles = [];
      
      // 2. Upload Formulir
      if (form.formulir) {
        var folderFormulir = getOrCreateFolder(stageFolder, FOLDER_NAMES.JENIS.FORMULIR_USULAN);
        var ext = getFileExtension(form.formulir.name) || "pdf";
        var base64Data = form.formulir.base64.indexOf(',') !== -1 ? form.formulir.base64.split(',')[1] : form.formulir.base64;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), form.formulir.mimeType, "FORM_" + form.judulSingkat + "_v1." + ext);
        var file = folderFormulir.createFile(blob);
        docActiveId = file.getId();
        docHistoryJson = { "v1": docActiveId };
      }
      
      // 3. Upload Kajian (Multiple)
      if (form.kajian && form.kajian.length > 0) {
        var folderKajian = getOrCreateFolder(stageFolder, FOLDER_NAMES.JENIS.KAJIAN_ILMIAH);
        form.kajian.forEach(function(fileData, idx) {
          var numStr = String(idx + 1).padStart(3, "0");
          var newName = "KAJIAN_" + form.judulSingkat + "_" + numStr;
          var ext = getFileExtension(fileData.name) || "pdf";
          var base64Data = fileData.base64.indexOf(',') !== -1 ? fileData.base64.split(',')[1] : fileData.base64;
          var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileData.mimeType, newName + "." + ext);
          var file = folderKajian.createFile(blob);
          var meta = buildFileMetadata(file.getId(), newName + "." + ext, 1, requesterEmail);
          kajianFiles.push(meta);
        });
      }
      
      // 4. Upload Foto (Multiple)
      if (form.foto && form.foto.length > 0) {
        var folderFoto = getOrCreateFolder(stageFolder, FOLDER_NAMES.JENIS.FOTO_DOKUMENTASI);
        form.foto.forEach(function(fileData, idx) {
          var numStr = String(idx + 1).padStart(3, "0");
          var newName = "FOTO_" + form.judulSingkat + "_" + numStr;
          var ext = getFileExtension(fileData.name) || "jpg";
          var base64Data = fileData.base64.indexOf(',') !== -1 ? fileData.base64.split(',')[1] : fileData.base64;
          var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileData.mimeType, newName + "." + ext);
          var file = folderFoto.createFile(blob);
          var meta = buildFileMetadata(file.getId(), newName + "." + ext, 1, requesterEmail);
          fotoFiles.push(meta);
        });
      }
      
      // 5. Upload Video (URL Txt)
      if (form.videoUrl) {
        var folderVideo = getOrCreateFolder(stageFolder, FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
        var newName = "VID_" + form.judulSingkat + "_001.txt";
        var isiFile = [
          "URL: " + form.videoUrl,
          "Diunggah oleh: " + requesterEmail,
          "Tanggal: " + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")
        ].join("\n");
        var blob = Utilities.newBlob(isiFile, "text/plain", newName);
        folderVideo.createFile(blob);
      }
      
      // 6. Upload Presentasi
      if (form.presentasi) {
        var folderPres = getOrCreateFolder(stageFolder, "PRESENTASI");
        var ext = getFileExtension(form.presentasi.name) || "pdf";
        var base64Data = form.presentasi.base64.indexOf(',') !== -1 ? form.presentasi.base64.split(',')[1] : form.presentasi.base64;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), form.presentasi.mimeType, "PRESENTASI_" + form.judulSingkat + "_v1." + ext);
        var file = folderPres.createFile(blob);
        var meta = buildFileMetadata(file.getId(), "PRESENTASI_" + form.judulSingkat + "_v1." + ext, 1, requesterEmail);
        presentasiFiles.push(meta);
      }
      
      // 7. Upload Sertifikat (wajib jika Final)
      if (form.status === STATUS.FINAL && !form.sertifikat) {
        throw new Error("Sertifikat wajib diunggah untuk status Final.");
      }
      if (form.sertifikat) {
        var folderSert = getOrCreateFolder(stageFolder, "SERTIFIKAT");
        var ext = getFileExtension(form.sertifikat.name) || "pdf";
        var base64Data = form.sertifikat.base64.indexOf(',') !== -1 ? form.sertifikat.base64.split(',')[1] : form.sertifikat.base64;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), form.sertifikat.mimeType, "SERTIFIKAT_" + form.judulSingkat + "_" + form.tahunPenetapan + "." + ext);
        var file = folderSert.createFile(blob);
        var meta = buildFileMetadata(file.getId(), "SERTIFIKAT_" + form.judulSingkat + "_" + form.tahunPenetapan + "." + ext, 1, requesterEmail);
        sertifikatFiles.push(meta);
      }
      
      // 8. Tambah baris database
      var newRow = new Array(TOTAL_COLS_WBTB).fill("");
      newRow[COL.ID] = proposalId;
      newRow[COL.NAMA_KARYA] = form.namaKarya;
      newRow[COL.JUDUL_SINGKAT] = form.judulSingkat;
      newRow[COL.DOMAIN] = form.domain;
      newRow[COL.TAHUN_USULAN] = form.tahunPenetapan;
      newRow[COL.ENTRY_TYPE] = ENTRY_TYPE.HISTORIS;
      newRow[COL.STATUS] = form.status;
      newRow[COL.FOLDER_KARYA_ID] = folderResult.folderKaryaId;
      newRow[COL.FOLDER_IDS_JSON] = JSON.stringify(folderResult.folderIds);
      
      newRow[COL.DOC_ACTIVE_ID] = docActiveId;
      newRow[COL.DOC_HISTORY_JSON] = JSON.stringify(docHistoryJson);
      newRow[COL.KAJIAN_FILES_JSON] = JSON.stringify(kajianFiles);
      newRow[COL.FOTO_FILES_JSON] = JSON.stringify(fotoFiles);
      newRow[COL.VIDEO_URL] = form.videoUrl || "";
      newRow[COL.PRESENTASI_FILES_JSON] = JSON.stringify(presentasiFiles);
      newRow[COL.SERTIFIKAT_FILES_JSON] = JSON.stringify(sertifikatFiles);
      newRow[COL.DRIVE_LOCKED] = true;
      newRow[COL.CREATED_AT] = new Date();
      newRow[COL.UPDATED_AT] = new Date();
      if (form.keterangan) {
        newRow[COL.CATATAN_ATASAN] = form.keterangan;
      }
      if (form.status === STATUS.DITANGGUHKAN) {
        newRow[COL.DITANGGUHKAN_AT] = new Date();
      }
      
      sheet.appendRow(newRow);
      
      writeAuditLog("IMPORT_HISTORIS", "Operator " + requesterEmail + " mengimpor arsip " + form.status + ": " + proposalId + " - " + form.namaKarya);
      return { success: true, proposalId: proposalId };
    });
  } catch (err) {
    Logger.log("importArsipHistoris error: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

function editArsipHistoris(requesterEmail, proposalId, form) {
  try {
    var role = requireRole(requesterEmail, [ROLES.OPERATOR]);
    
    if (!form.namaKarya || !form.judulSingkat || !form.domain || !form.tahunPenetapan || !form.status) {
      throw new Error("Nama Karya, Judul Singkat, Domain, Tahun, dan Status wajib diisi.");
    }
    
    var validasiJudul = validateJudulSingkat(form.judulSingkat);
    if (!validasiJudul.valid) throw new Error(validasiJudul.pesan);
    
    return DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
      var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
      if (!hasil) throw new Error("Arsip tidak ditemukan.");
      
      var row = hasil.rowData;
      if (row[COL.ENTRY_TYPE] !== ENTRY_TYPE.HISTORIS) {
        throw new Error("Hanya arsip historis yang dapat diubah.");
      }
      
      var oldNamaKarya = row[COL.NAMA_KARYA];
      var oldJudulSingkat = row[COL.JUDUL_SINGKAT];
      var oldTahun = row[COL.TAHUN_USULAN];
      var oldStatus = row[COL.STATUS];
      var folderKaryaId = row[COL.FOLDER_KARYA_ID];
      
      var folderIds = safeParseJSON(row[COL.FOLDER_IDS_JSON], {});
      var docActiveId = row[COL.DOC_ACTIVE_ID] || "";
      var docHistoryJson = safeParseJSON(row[COL.DOC_HISTORY_JSON], {});
      var kajianFiles = safeParseJSON(row[COL.KAJIAN_FILES_JSON], []);
      var fotoFiles = safeParseJSON(row[COL.FOTO_FILES_JSON], []);
      var videoUrl = row[COL.VIDEO_URL] || "";
      var presentasiFiles = safeParseJSON(row[COL.PRESENTASI_FILES_JSON], []);
      var sertifikatFiles = safeParseJSON(row[COL.SERTIFIKAT_FILES_JSON], []);
      
      // 1. Rename folder utama jika namaKarya berubah
      if (form.namaKarya !== oldNamaKarya && folderKaryaId) {
        try {
          var folderKarya = DriveApp.getFolderById(folderKaryaId);
          var newFolderName = formatNamaFolderKarya(proposalId, form.namaKarya);
          folderKarya.setName(newFolderName);
        } catch (e) {
          Logger.log("Warning: gagal rename folder utama: " + e.toString());
        }
      }
      
      // 2. Handle Perubahan Status (Final <-> Ditangguhkan)
      if (form.status !== oldStatus && folderKaryaId) {
        try {
          var folderKarya = DriveApp.getFolderById(folderKaryaId);
          if (form.status === STATUS.DITANGGUHKAN) {
            var finalId = folderIds["FINAL"];
            if (finalId) {
              DriveApp.getFolderById(finalId).setName(FOLDER_NAMES.TAHAP.ARSIP_DITANGGUHKAN);
              folderIds["ARSIP_DITANGGUHKAN"] = finalId;
              delete folderIds["FINAL"];
            }
          } else {
            var tangguhId = folderIds["ARSIP_DITANGGUHKAN"];
            if (tangguhId) {
              DriveApp.getFolderById(tangguhId).setName(FOLDER_NAMES.TAHAP.FINAL);
              folderIds["FINAL"] = tangguhId;
              delete folderIds["ARSIP_DITANGGUHKAN"];
            }
          }
        } catch (e) {
          Logger.log("Warning: gagal transisi folder status: " + e.toString());
        }
      }
      
      var stageKey = (form.status === STATUS.DITANGGUHKAN) ? "ARSIP_DITANGGUHKAN" : "FINAL";
      var stageFolderId = folderIds[stageKey];
      var stageFolder = DriveApp.getFolderById(stageFolderId);
      
      // 3. Handle Deleted Files
      if (form.deletedFileIds && form.deletedFileIds.length > 0) {
        form.deletedFileIds.forEach(function(fid) {
          trashDriveFileSafely(fid);
          
          if (docActiveId === fid) {
            docActiveId = "";
            docHistoryJson = {};
          }
          kajianFiles = kajianFiles.filter(function(f) { return f.fileId !== fid; });
          fotoFiles = fotoFiles.filter(function(f) { return f.fileId !== fid; });
          presentasiFiles = presentasiFiles.filter(function(f) { return f.fileId !== fid; });
          sertifikatFiles = sertifikatFiles.filter(function(f) { return f.fileId !== fid; });
        });
      }
      
      // 4. Handle Rename Files if judulSingkat or tahunPenetapan changed
      var judulChanged = (form.judulSingkat !== oldJudulSingkat);
      var tahunChanged = (form.tahunPenetapan !== oldTahun);
      
      if ((judulChanged || tahunChanged) && folderKaryaId) {
        if (docActiveId) {
          try {
            var file = DriveApp.getFileById(docActiveId);
            var ext = getFileExtension(file.getName()) || "pdf";
            file.setName("FORM_" + form.judulSingkat + "_v1." + ext);
          } catch(e) { Logger.log("Gagal rename Formulir: " + e.toString()); }
        }
        
        kajianFiles.forEach(function(f, idx) {
          try {
            var file = DriveApp.getFileById(f.fileId);
            var ext = getFileExtension(file.getName()) || "pdf";
            var newName = "KAJIAN_" + form.judulSingkat + "_" + String(idx + 1).padStart(3, "0") + "." + ext;
            file.setName(newName);
            f.name = newName;
          } catch(e) { Logger.log("Gagal rename Kajian file: " + e.toString()); }
        });
        
        fotoFiles.forEach(function(f, idx) {
          try {
            var file = DriveApp.getFileById(f.fileId);
            var ext = getFileExtension(file.getName()) || "jpg";
            var newName = "FOTO_" + form.judulSingkat + "_" + String(idx + 1).padStart(3, "0") + "." + ext;
            file.setName(newName);
            f.name = newName;
          } catch(e) { Logger.log("Gagal rename Foto file: " + e.toString()); }
        });
        
        presentasiFiles.forEach(function(f) {
          try {
            var file = DriveApp.getFileById(f.fileId);
            var ext = getFileExtension(file.getName()) || "pdf";
            var newName = "PRESENTASI_" + form.judulSingkat + "_v1." + ext;
            file.setName(newName);
            f.name = newName;
          } catch(e) { Logger.log("Gagal rename Presentasi file: " + e.toString()); }
        });
        
        sertifikatFiles.forEach(function(f) {
          try {
            var file = DriveApp.getFileById(f.fileId);
            var ext = getFileExtension(file.getName()) || "pdf";
            var newName = "SERTIFIKAT_" + form.judulSingkat + "_" + form.tahunPenetapan + "." + ext;
            file.setName(newName);
            f.name = newName;
          } catch(e) { Logger.log("Gagal rename Sertifikat file: " + e.toString()); }
        });
      }
      
      // 5. Upload New/Replacement Files
      if (form.formulir) {
        if (docActiveId) {
          trashDriveFileSafely(docActiveId);
        }
        var folderFormulir = getOrCreateFolder(stageFolder, FOLDER_NAMES.JENIS.FORMULIR_USULAN);
        var ext = getFileExtension(form.formulir.name) || "pdf";
        var base64Data = form.formulir.base64.indexOf(',') !== -1 ? form.formulir.base64.split(',')[1] : form.formulir.base64;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), form.formulir.mimeType, "FORM_" + form.judulSingkat + "_v1." + ext);
        var file = folderFormulir.createFile(blob);
        docActiveId = file.getId();
        docHistoryJson = { "v1": docActiveId };
      }
      
      if (form.kajian && form.kajian.length > 0) {
        var folderKajian = getOrCreateFolder(stageFolder, FOLDER_NAMES.JENIS.KAJIAN_ILMIAH);
        var nextIdx = kajianFiles.length;
        form.kajian.forEach(function(fileData, idx) {
          var numStr = String(nextIdx + idx + 1).padStart(3, "0");
          var newName = "KAJIAN_" + form.judulSingkat + "_" + numStr;
          var ext = getFileExtension(fileData.name) || "pdf";
          var base64Data = fileData.base64.indexOf(',') !== -1 ? fileData.base64.split(',')[1] : fileData.base64;
          var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileData.mimeType, newName + "." + ext);
          var file = folderKajian.createFile(blob);
          var meta = buildFileMetadata(file.getId(), newName + "." + ext, 1, requesterEmail);
          kajianFiles.push(meta);
        });
      }
      
      if (form.foto && form.foto.length > 0) {
        var folderFoto = getOrCreateFolder(stageFolder, FOLDER_NAMES.JENIS.FOTO_DOKUMENTASI);
        var nextIdx = fotoFiles.length;
        form.foto.forEach(function(fileData, idx) {
          var numStr = String(nextIdx + idx + 1).padStart(3, "0");
          var newName = "FOTO_" + form.judulSingkat + "_" + numStr;
          var ext = getFileExtension(fileData.name) || "jpg";
          var base64Data = fileData.base64.indexOf(',') !== -1 ? fileData.base64.split(',')[1] : fileData.base64;
          var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileData.mimeType, newName + "." + ext);
          var file = folderFoto.createFile(blob);
          var meta = buildFileMetadata(file.getId(), newName + "." + ext, 1, requesterEmail);
          fotoFiles.push(meta);
        });
      }
      
      if (form.videoUrl !== undefined && form.videoUrl !== videoUrl) {
        videoUrl = form.videoUrl;
        var folderVideo = getOrCreateFolder(stageFolder, FOLDER_NAMES.JENIS.VIDEO_DOKUMENTASI);
        
        var files = folderVideo.getFiles();
        while (files.hasNext()) {
          var f = files.next();
          if (f.getName().indexOf("VID_" + oldJudulSingkat) === 0 || f.getName().indexOf("VID_" + form.judulSingkat) === 0) {
            trashDriveFileSafely(f.getId());
          }
        }
        
        if (videoUrl) {
          var newName = "VID_" + form.judulSingkat + "_001.txt";
          var isiFile = [
            "URL: " + videoUrl,
            "Diunggah oleh: " + requesterEmail,
            "Tanggal: " + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")
          ].join("\n");
          var blob = Utilities.newBlob(isiFile, "text/plain", newName);
          folderVideo.createFile(blob);
        }
      }
      
      if (form.presentasi) {
        presentasiFiles.forEach(function(pf) { trashDriveFileSafely(pf.fileId); });
        presentasiFiles = [];
        
        var folderPres = getOrCreateFolder(stageFolder, "PRESENTASI");
        var ext = getFileExtension(form.presentasi.name) || "pdf";
        var base64Data = form.presentasi.base64.indexOf(',') !== -1 ? form.presentasi.base64.split(',')[1] : form.presentasi.base64;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), form.presentasi.mimeType, "PRESENTASI_" + form.judulSingkat + "_v1." + ext);
        var file = folderPres.createFile(blob);
        var meta = buildFileMetadata(file.getId(), "PRESENTASI_" + form.judulSingkat + "_v1." + ext, 1, requesterEmail);
        presentasiFiles.push(meta);
      }
      
      if (form.sertifikat) {
        sertifikatFiles.forEach(function(sf) { trashDriveFileSafely(sf.fileId); });
        sertifikatFiles = [];
        
        var folderSert = getOrCreateFolder(stageFolder, "SERTIFIKAT");
        var ext = getFileExtension(form.sertifikat.name) || "pdf";
        var base64Data = form.sertifikat.base64.indexOf(',') !== -1 ? form.sertifikat.base64.split(',')[1] : form.sertifikat.base64;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), form.sertifikat.mimeType, "SERTIFIKAT_" + form.judulSingkat + "_" + form.tahunPenetapan + "." + ext);
        var file = folderSert.createFile(blob);
        var meta = buildFileMetadata(file.getId(), "SERTIFIKAT_" + form.judulSingkat + "_" + form.tahunPenetapan + "." + ext, 1, requesterEmail);
        sertifikatFiles.push(meta);
      }
      
      // 6. Update spreadsheet row
      var rIdx = hasil.rowIndex;
      sheet.getRange(rIdx, COL.NAMA_KARYA + 1).setValue(form.namaKarya);
      sheet.getRange(rIdx, COL.JUDUL_SINGKAT + 1).setValue(form.judulSingkat);
      sheet.getRange(rIdx, COL.DOMAIN + 1).setValue(form.domain);
      sheet.getRange(rIdx, COL.TAHUN_USULAN + 1).setValue(form.tahunPenetapan);
      sheet.getRange(rIdx, COL.STATUS + 1).setValue(form.status);
      sheet.getRange(rIdx, COL.FOLDER_IDS_JSON + 1).setValue(JSON.stringify(folderIds));
      
      sheet.getRange(rIdx, COL.DOC_ACTIVE_ID + 1).setValue(docActiveId);
      sheet.getRange(rIdx, COL.DOC_HISTORY_JSON + 1).setValue(JSON.stringify(docHistoryJson));
      sheet.getRange(rIdx, COL.KAJIAN_FILES_JSON + 1).setValue(JSON.stringify(kajianFiles));
      sheet.getRange(rIdx, COL.FOTO_FILES_JSON + 1).setValue(JSON.stringify(fotoFiles));
      sheet.getRange(rIdx, COL.VIDEO_URL + 1).setValue(videoUrl);
      sheet.getRange(rIdx, COL.PRESENTASI_FILES_JSON + 1).setValue(JSON.stringify(presentasiFiles));
      sheet.getRange(rIdx, COL.SERTIFIKAT_FILES_JSON + 1).setValue(JSON.stringify(sertifikatFiles));
      
      sheet.getRange(rIdx, COL.CATATAN_ATASAN + 1).setValue(form.keterangan || "");
      sheet.getRange(rIdx, COL.UPDATED_AT + 1).setValue(new Date());
      
      if (form.status === STATUS.DITANGGUHKAN && oldStatus !== STATUS.DITANGGUHKAN) {
        sheet.getRange(rIdx, COL.DITANGGUHKAN_AT + 1).setValue(new Date());
      } else if (form.status !== STATUS.DITANGGUHKAN) {
        sheet.getRange(rIdx, COL.DITANGGUHKAN_AT + 1).setValue("");
      }
      
      writeAuditLog("EDIT_HISTORIS", "Operator " + requesterEmail + " mengubah arsip historis: " + proposalId + " - " + form.namaKarya);
      
      return { success: true };
    });
  } catch (err) {
    Logger.log("editArsipHistoris error: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

function deleteArsipHistoris(requesterEmail, proposalId) {
  try {
    var role = requireRole(requesterEmail, [ROLES.OPERATOR]);
    
    return DatabaseEngine.executeTransaction(DB_NAMES.WBTB_LINGGA, function(sheet) {
      var hasil = DatabaseEngine.findRow(sheet, COL.ID, proposalId);
      if (!hasil) throw new Error("Arsip tidak ditemukan.");
      
      var row = hasil.rowData;
      if (row[COL.ENTRY_TYPE] !== ENTRY_TYPE.HISTORIS) {
        throw new Error("Hanya arsip historis yang dapat dihapus.");
      }
      
      var folderKaryaId = row[COL.FOLDER_KARYA_ID];
      
      // 1. Move folder utama di Google Drive ke Trash
      if (folderKaryaId) {
        try {
          var folder = DriveApp.getFolderById(folderKaryaId);
          folder.setTrashed(true);
        } catch (e) {
          Logger.log("Warning: gagal men-trash folder karya " + folderKaryaId + ": " + e.toString());
        }
      }
      
      // 2. Hapus baris di database
      sheet.deleteRow(hasil.rowIndex);
      
      writeAuditLog("DELETE_HISTORIS", "Operator " + requesterEmail + " menghapus arsip historis: " + proposalId + " - " + row[COL.NAMA_KARYA]);
      
      return { success: true };
    });
  } catch (err) {
    Logger.log("deleteArsipHistoris error: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

function getFileExtension(filename) {
  if (!filename) return "";
  var parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}