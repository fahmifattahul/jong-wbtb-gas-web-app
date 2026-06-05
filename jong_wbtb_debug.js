/**
 * JONG WBTb — Standalone Diagnosis Script
 * Salin seluruh kode ini dan jalankan fungsi runDebugProposal() di Google Apps Script editor.
 */

function runDebugProposal() {
  // Ganti "WBTB-001" dengan ID proposal Anda jika berbeda
  var PROPOSAL_ID = "WBTB-001";
  
  var DB_WBTB_LINGGA = "db_wbtb_lingga";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DB_WBTB_LINGGA);
  
  if (!sheet) {
    Logger.log("ERROR: Sheet '" + DB_WBTB_LINGGA + "' tidak ditemukan di spreadsheet aktif!");
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  // Cari index kolom penting
  var colId = headers.indexOf("id");
  var colStatus = headers.indexOf("status");
  var colJudul = headers.indexOf("judul_singkat");
  var colKajian = headers.indexOf("kajian_files_json");
  var colPres = headers.indexOf("presentasi_files_json");
  var colSert = headers.indexOf("sertifikat_files_json");
  var colFolderIds = headers.indexOf("folder_ids_json");
  
  Logger.log("=== MENCARI PROPOSAL: " + PROPOSAL_ID + " ===");
  var rowIndex = -1;
  var rowData = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colId]).toUpperCase() === PROPOSAL_ID.toUpperCase()) {
      rowIndex = i + 1;
      rowData = data[i];
      break;
    }
  }
  
  if (rowIndex === -1) {
    Logger.log("ERROR: Proposal '" + PROPOSAL_ID + "' tidak ditemukan di baris data manapun!");
    return;
  }
  
  Logger.log("Proposal ditemukan di baris ke: " + rowIndex);
  Logger.log("Status Usulan: " + rowData[colStatus]);
  Logger.log("Judul Singkat: " + rowData[colJudul]);
  
  var folderIdsRaw = rowData[colFolderIds];
  Logger.log("Folder IDs JSON: " + folderIdsRaw);
  
  var kajianRaw = rowData[colKajian];
  var presRaw = rowData[colPres];
  var sertRaw = rowData[colSert];
  
  Logger.log("KAJIAN_FILES_JSON: " + kajianRaw);
  Logger.log("PRESENTASI_FILES_JSON: " + presRaw);
  Logger.log("SERTIFIKAT_FILES_JSON: " + sertRaw);
  
  var kajianList = safeParseJSON(kajianRaw, []);
  var presList = safeParseJSON(presRaw, []);
  var sertList = safeParseJSON(sertRaw, []);
  
  Logger.log("\n--- [1] ANALISIS KAJIAN ILMIAH ---");
  if (kajianList.length === 0) {
    Logger.log("Tidak ada berkas Kajian Ilmiah.");
  } else {
    kajianList.forEach(function(f, idx) {
      Logger.log("Kajian [" + idx + "]: fileId=" + f.fileId + ", name=" + f.name + ", status=" + f.status);
      checkDriveFileInfo(f.fileId);
    });
  }
  
  Logger.log("\n--- [2] ANALISIS PRESENTASI ---");
  if (presList.length === 0) {
    Logger.log("Tidak ada berkas Presentasi.");
  } else {
    presList.forEach(function(f, idx) {
      Logger.log("Presentasi [" + idx + "]: fileId=" + f.fileId + ", name=" + f.name + ", status=" + f.status);
      checkDriveFileInfo(f.fileId);
    });
  }
  
  Logger.log("\n--- [3] ANALISIS SERTIFIKAT ---");
  if (sertList.length === 0) {
    Logger.log("Tidak ada berkas Sertifikat.");
  } else {
    sertList.forEach(function(f, idx) {
      Logger.log("Sertifikat [" + idx + "]: fileId=" + f.fileId + ", name=" + f.name + ", status=" + f.status);
      checkDriveFileInfo(f.fileId);
    });
  }
}

function checkDriveFileInfo(fileId) {
  if (!fileId) {
    Logger.log("  - ERROR: File ID kosong / undefined");
    return;
  }
  try {
    var file = DriveApp.getFileById(fileId);
    Logger.log("  - Hasil: FILE DITEMUKAN!");
    Logger.log("  - Nama di Drive: " + file.getName());
    Logger.log("  - Ukuran: " + file.getSize() + " bytes");
    Logger.log("  - MIME Type: " + file.getMimeType());
    Logger.log("  - Sharing Access: " + file.getSharingAccess().toString());
    Logger.log("  - Sharing Permission: " + file.getSharingPermission().toString());
    Logger.log("  - Owner/Pemilik: " + file.getOwner().getEmail());
    Logger.log("  - Link Preview Resmi: " + file.getUrl());
    
    var parents = file.getParents();
    while (parents.hasNext()) {
      var p = parents.next();
      Logger.log("  - Folder Induk: " + p.getName() + " (ID: " + p.getId() + ")");
    }
  } catch (e) {
    Logger.log("  - ERROR: Gagal mengakses file dari Drive. Detail: " + e.toString());
  }
}

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}
