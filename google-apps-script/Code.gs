/**
 * MedSched Panel — Google Apps Script Backend
 * Deployed as a Web App to sync patient data with Google Sheets
 *
 * Configuration:
 * - Deploy as: Execute as Me (the script owner)
 * - Who has access: Anyone
 * - This script reads/writes data from/to the linked Google Sheet
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const VALID_API_KEYS = ['medsched-2026-key-abc123']; // Add your API key(s) here
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

const SHEET_NAMES = {
  portcath: 'PortCath',
  admissions: 'Admissions',
  followup: 'FollowUp',
  tumorboard: 'TumorBoard',
  clinic: 'ClinicAppointments',
  'portcath-session-config': 'PortCathSessionConfig',
  'portcath-history': 'PortCathHistory',
  audit_log: 'AuditLog',
  settings: 'Settings'
};

// Column indices (A=0, B=1, etc.)
// PortCath final schema (15 columns):
//   A   B     C           D     E    F       G       H       I      J          K          L          M        N            O
//   id  name  fileNumber  date  day  weight  notes  status  phone  createdAt  updatedAt  deletedAt  version  preparedBy  nextChemoAppt
const COLUMN_MAP = {
  portcath: {
    id: 0, name: 1, fileNumber: 2, date: 3, day: 4, weight: 5, notes: 6,
    status: 7, phone: 8,
    createdAt: 9, updatedAt: 10, deletedAt: 11, version: 12, preparedBy: 13,
    nextChemoAppt: 14
  },
  'portcath-session-config': {
    id: 0, date: 1, year: 2, month: 3, dayOfWeek: 4, isActive: 5, syncStatus: 6,
    createdAt: 7, updatedAt: 8, deletedAt: 9, version: 10, preparedBy: 11
  },
  'portcath-history': {
    id: 0, patientId: 1, patientName: 2, fileNumber: 3, action: 4,
    fromDate: 5, toDate: 6, reason: 7, note: 8, timestamp: 9, syncStatus: 10,
    createdAt: 11, updatedAt: 12, deletedAt: 13, version: 14, preparedBy: 15
  },
  admissions: {
    id: 0, name: 1, fileNumber: 2, age: 3, triageScore: 4, primaryPhysician: 5,
    placeOfReferral: 6, modeOfTransportation: 7, performanceStatus: 8,
    admissionDepartment: 9, date: 10, summary: 11, causeOfAdmission: 12, notes: 13,
    createdAt: 14, updatedAt: 15, deletedAt: 16, version: 17, preparedBy: 18
  },
  followup: {
    id: 0, name: 1, phone: 2, fileNumber: 3, date: 4, task: 5, taskResult: 6,
    createdAt: 7, updatedAt: 8, deletedAt: 9, version: 10, preparedBy: 11
  },
  tumorboard: {
    id: 0, name: 1, fileNumber: 2, age: 3, physician: 4, diagnosis: 5, notes: 6,
    tasks: 7, createdAt: 8, updatedAt: 9, deletedAt: 10, version: 11, preparedBy: 12
  },
  clinic: {
    id: 0, name: 1, fileNumber: 2, age: 3, date: 4, primaryPhysician: 5,
    case: 6, causeOfAdmission: 7, note: 8,
    createdAt: 9, updatedAt: 10, deletedAt: 11, version: 12
  }
};

const AUDIT_LOG_COLUMNS = {
  timestamp: 0, action: 1, module: 2, recordId: 3,
  displayName: 4, beforeJson: 5, afterJson: 6
};

// ============================================================================
// HTTP HANDLERS
// ============================================================================

function doGet(e) {
  const callback = e.parameter.callback;
  try {
    const action = e.parameter.action;
    const key = e.parameter.key;

    if (!validateApiKey(key)) {
      return callback
        ? jsonpResponse({ status: 'error', code: 'INVALID_KEY', message: 'Authentication failed' }, callback)
        : errorResponse('INVALID_KEY', 'Authentication failed', 403);
    }

    switch (action) {
      case 'setup':
        initializeSpreadsheet();
        return callback
          ? jsonpResponse({ status: 'ok', message: 'Spreadsheet initialized' }, callback)
          : successResponse({ status: 'ok', message: 'Spreadsheet initialized' });

      case 'migrate':
        const result = migratePortCathSchemaFull();
        return callback
          ? jsonpResponse({ status: 'ok', message: 'Migration complete', result }, callback)
          : successResponse({ status: 'ok', message: 'Migration complete', result });

      case 'getAll':
        ensureSheetsExist();
        const allData = { status: 'ok' };
        Object.assign(allData, getAllData());
        return callback ? jsonpResponse(allData, callback) : successResponse(getAllData());

      case 'getByDate':
        const type = e.parameter.type;
        const date = e.parameter.date;
        if (!type || !date) {
          return callback
            ? jsonpResponse({ status: 'error', code: 'MISSING_PARAMS', message: 'type and date required' }, callback)
            : errorResponse('MISSING_PARAMS', 'type and date required', 400);
        }
        ensureSheetsExist();
        const byDateData = { status: 'ok' };
        Object.assign(byDateData, getByDate(type, date));
        return callback ? jsonpResponse(byDateData, callback) : successResponse(getByDate(type, date));

      case 'getSettings':
        ensureSheetsExist();
        const settingsData = { status: 'ok' };
        Object.assign(settingsData, getSettings());
        return callback ? jsonpResponse(settingsData, callback) : successResponse(getSettings());

      default:
        return callback
          ? jsonpResponse({ status: 'error', code: 'INVALID_ACTION', message: `Unknown action: ${action}` }, callback)
          : errorResponse('INVALID_ACTION', `Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return callback
      ? jsonpResponse({ status: 'error', code: 'INTERNAL_ERROR', message: err.toString() }, callback)
      : errorResponse('INTERNAL_ERROR', err.toString(), 500);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const key = payload.key;

    if (!validateApiKey(key)) {
      return errorResponse('INVALID_KEY', 'Authentication failed', 403);
    }

    const action = payload.action;

    switch (action) {
      case 'createRecord':  return createRecordHandler(payload);
      case 'updateRecord':  return updateRecordHandler(payload);
      case 'deleteRecord':  return deleteRecordHandler(payload);
      case 'syncBatch':     return syncBatchHandler(payload);
      case 'writeAuditLog': return writeAuditLogHandler(payload);
      case 'writeSetting':  return writeSettingHandler(payload);
      case 'clearType':     return clearTypeHandler(payload);
      default:              return errorResponse('INVALID_ACTION', `Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', err.toString(), 500);
  }
}

// ============================================================================
// ACTION HANDLERS (POST)
// ============================================================================

function createRecordHandler(payload) {
  const type = payload.type;
  const record = payload.record;
  const displayName = payload.displayName || 'Unknown';

  if (!type || !record || !record.id) {
    return errorResponse('MISSING_PARAMS', 'type, record, and record.id required', 400);
  }

  record.id = String(record.id);
  if (record.fileNumber !== undefined && record.fileNumber !== null) {
    record.fileNumber = String(record.fileNumber);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);

  const existingRow = findRowByIdInSheet(sheet, COLUMN_MAP[type], record.id);
  if (existingRow > 0) return errorResponse('DUPLICATE_RECORD', `Record ${record.id} already exists`, 409);

  const now = new Date().toISOString();
  record.createdAt = record.createdAt || now;
  record.updatedAt = now;
  record.deletedAt = null;
  record.version = 1;
  record.preparedBy = displayName;

  sheet.appendRow(recordToRow(type, record));

  writeAuditLog({
    timestamp: now, action: 'CREATE', module: type, recordId: record.id,
    displayName, beforeJson: null, afterJson: JSON.stringify(record)
  });

  return successResponse({ status: 'ok', id: record.id });
}

function updateRecordHandler(payload) {
  const type = payload.type;
  const record = payload.record;
  const displayName = payload.displayName || 'Unknown';

  if (type === 'portcath-history') {
    return errorResponse('NOT_ALLOWED', 'portcath-history is append-only and cannot be updated', 403);
  }

  if (!type || !record || !record.id) {
    return errorResponse('MISSING_PARAMS', 'type, record, and record.id required', 400);
  }

  record.id = String(record.id);
  if (record.fileNumber !== undefined && record.fileNumber !== null) {
    record.fileNumber = String(record.fileNumber);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);

  const rowIndex = findRowByIdInSheet(sheet, COLUMN_MAP[type], record.id);
  if (rowIndex <= 0) return errorResponse('NOT_FOUND', `Record ${record.id} not found`, 404);

  const beforeRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const beforeRecord = rowToRecord(type, beforeRow);

  const now = new Date().toISOString();
  record.updatedAt = now;
  record.createdAt = record.createdAt || beforeRecord.createdAt;
  record.version = (record.version || 0) + 1;
  record.preparedBy = displayName;

  const newRow = recordToRow(type, record);
  sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);

  writeAuditLog({
    timestamp: now, action: 'UPDATE', module: type, recordId: record.id,
    displayName, beforeJson: JSON.stringify(beforeRecord), afterJson: JSON.stringify(record)
  });

  return successResponse({ status: 'ok', updated: true });
}

function deleteRecordHandler(payload) {
  const type = payload.type;
  const id = payload.id !== undefined && payload.id !== null ? String(payload.id) : '';
  const displayName = payload.displayName || 'Unknown';

  if (type === 'portcath-history') {
    return errorResponse('NOT_ALLOWED', 'portcath-history is append-only and cannot be deleted', 403);
  }

  if (!type || !id) return errorResponse('MISSING_PARAMS', 'type and id required', 400);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);

  const rowIndex = findRowByIdInSheet(sheet, COLUMN_MAP[type], id);
  if (rowIndex <= 0) return errorResponse('NOT_FOUND', `Record ${id} not found`, 404);

  const beforeRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const beforeRecord = rowToRecord(type, beforeRow);

  const now = new Date().toISOString();
  beforeRecord.deletedAt = now;
  beforeRecord.updatedAt = now;
  beforeRecord.version = (beforeRecord.version || 0) + 1;
  beforeRecord.preparedBy = displayName;

  const newRow = recordToRow(type, beforeRecord);
  sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);

  writeAuditLog({
    timestamp: now, action: 'DELETE', module: type, recordId: id,
    displayName, beforeJson: JSON.stringify(beforeRecord), afterJson: JSON.stringify(beforeRecord)
  });

  return successResponse({ status: 'ok', deleted: true });
}

function clearTypeHandler(payload) {
  const type = payload.type;
  if (!type || !SHEET_NAMES[type]) return errorResponse('MISSING_PARAMS', 'valid type required', 400);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return successResponse({ cleared: 0 });

  const now     = new Date().toISOString();
  const colMap  = COLUMN_MAP[type];
  const numCols = sheet.getLastColumn();
  const data    = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  let cleared   = 0;

  data.forEach((row, i) => {
    if (row[colMap.id] && !row[colMap.deletedAt]) {
      sheet.getRange(i + 2, colMap.deletedAt + 1).setValue(now);
      sheet.getRange(i + 2, colMap.updatedAt + 1).setValue(now);
      cleared++;
    }
  });

  return successResponse({ cleared });
}

function syncBatchHandler(payload) {
  const type = payload.type;
  const operations = payload.operations || [];
  const displayName = payload.displayName || 'Unknown';

  if (!type || !Array.isArray(operations)) {
    return errorResponse('MISSING_PARAMS', 'type and operations array required', 400);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);

  let inserted = 0, updated = 0, skipped = 0;
  const now = new Date().toISOString();

  for (const op of operations) {
    const record = op.record;
    if (!record.id) { skipped++; continue; }

    record.id = String(record.id);
    if (record.fileNumber !== undefined && record.fileNumber !== null) {
      record.fileNumber = String(record.fileNumber);
    }

    const existingRow = findRowByIdInSheet(sheet, COLUMN_MAP[type], record.id);

    if (op.op === 'create' && existingRow <= 0) {
      record.createdAt = record.createdAt || now;
      record.updatedAt = now;
      record.deletedAt = null;
      record.version = 1;
      record.preparedBy = displayName;
      sheet.appendRow(recordToRow(type, record));
      inserted++;
      writeAuditLog({
        timestamp: now, action: 'BATCH_CREATE', module: type, recordId: record.id,
        displayName, beforeJson: null, afterJson: JSON.stringify(record)
      });
    } else if (op.op === 'update' && existingRow > 0) {
      const beforeRow = sheet.getRange(existingRow, 1, 1, sheet.getLastColumn()).getValues()[0];
      const beforeRecord = rowToRecord(type, beforeRow);
      record.updatedAt = now;
      record.createdAt = record.createdAt || beforeRecord.createdAt;
      record.version = (record.version || 0) + 1;
      record.preparedBy = displayName;
      const newRow = recordToRow(type, record);
      sheet.getRange(existingRow, 1, 1, newRow.length).setValues([newRow]);
      updated++;
      writeAuditLog({
        timestamp: now, action: 'BATCH_UPDATE', module: type, recordId: record.id,
        displayName, beforeJson: JSON.stringify(beforeRecord), afterJson: JSON.stringify(record)
      });
    } else {
      skipped++;
    }
  }

  return successResponse({ status: 'ok', inserted, updated, skipped });
}

function writeAuditLogHandler(payload) {
  writeAuditLog(payload);
  return successResponse({ status: 'ok' });
}

function writeSettingHandler(payload) {
  const key = payload.settingKey || payload.key;
  const value = payload.value;
  if (!key) return errorResponse('MISSING_PARAMS', 'key required', 400);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.settings);
  if (!sheet) return errorResponse('SHEET_NOT_FOUND', 'Settings sheet not found', 404);

  const data = sheet.getRange('A:B').getValues();
  let found = false;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      found = true;
      break;
    }
  }

  if (!found) sheet.appendRow([key, value, new Date().toISOString()]);

  return successResponse({ status: 'ok', key, value });
}

// ============================================================================
// ACTION HANDLERS (GET)
// ============================================================================

function getAllData() {
  return {
    portcath: getSheetData('portcath'),
    admissions: getSheetData('admissions'),
    followup: getSheetData('followup'),
    tumorboard: getSheetData('tumorboard'),
    clinic: getSheetData('clinic'),
    portcathSessionConfig: getSheetData('portcath-session-config'),
    portcathHistory: getSheetData('portcath-history')
  };
}

function getByDate(type, date) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) throw new Error(`Sheet ${type} not found`);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const results = [];

  for (const row of data) {
    const record = rowToRecord(type, row);
    if (isRealTimestamp(record.deletedAt)) continue;
    if (record.date === date) results.push(record);
  }

  return results;
}

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.settings);
  if (!sheet) return {};

  const data = sheet.getRange('A2:B' + sheet.getLastRow()).getValues();
  const result = {};
  for (const row of data) {
    if (row[0]) result[row[0]] = row[1];
  }
  return result;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create all sheets with correct headers.
 * Trigger via: ?action=setup&key=YOUR_KEY
 * Only creates sheets that don't exist yet — does NOT migrate existing data.
 */
function initializeSpreadsheet() {
  createSheetWithHeaders('PortCath', [
    'id', 'name', 'fileNumber', 'date', 'day', 'weight', 'notes',
    'status', 'phone',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy',
    'nextChemoAppt'
  ]);
  createSheetWithHeaders('PortCathSessionConfig', [
    'id', 'date', 'year', 'month', 'dayOfWeek', 'isActive', 'syncStatus',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);
  createSheetWithHeaders('PortCathHistory', [
    'id', 'patientId', 'patientName', 'fileNumber', 'action',
    'fromDate', 'toDate', 'reason', 'note', 'timestamp', 'syncStatus',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);
  createSheetWithHeaders('Admissions', [
    'id', 'name', 'fileNumber', 'age', 'triageScore', 'primaryPhysician',
    'placeOfReferral', 'modeOfTransportation', 'performanceStatus',
    'admissionDepartment', 'date', 'summary', 'causeOfAdmission', 'notes',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);
  createSheetWithHeaders('FollowUp', [
    'id', 'name', 'phone', 'fileNumber', 'date', 'task', 'taskResult',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);
  createSheetWithHeaders('TumorBoard', [
    'id', 'name', 'fileNumber', 'age', 'physician', 'diagnosis', 'notes',
    'tasks', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);
  createSheetWithHeaders('ClinicAppointments', [
    'id', 'name', 'fileNumber', 'age', 'date', 'primaryPhysician',
    'case', 'causeOfAdmission', 'note',
    'createdAt', 'updatedAt', 'deletedAt', 'version'
  ]);
  createSheetWithHeaders('AuditLog', [
    'timestamp', 'action', 'module', 'recordId', 'displayName', 'beforeJson', 'afterJson'
  ]);
  createSheetWithHeaders('Settings', ['key', 'value', 'updatedAt']);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('Settings');
  const settingsData = settingsSheet.getRange('A2:A').getValues();
  let hasSchemaVersion = false;
  for (const row of settingsData) {
    if (row[0] === 'schemaVersion') { hasSchemaVersion = true; break; }
  }
  if (!hasSchemaVersion) {
    settingsSheet.appendRow(['schemaVersion', '1.1.0', new Date().toISOString()]);
    settingsSheet.appendRow(['appName', 'MedSched Panel', new Date().toISOString()]);
  }
}

// ============================================================================
// MIGRATION — Run once to fix existing PortCath sheet schema
// ============================================================================

/**
 * Migrates the PortCath sheet to match the current COLUMN_MAP.
 *
 * Handles two historical schema versions that may exist in the sheet:
 *
 *   OLD schema (no status/phone columns):
 *     id name fileNumber date day weight notes | createdAt updatedAt deletedAt version preparedBy
 *
 *   NEW schema (status+phone added to GAS but sheet not updated — data in wrong columns):
 *     id name fileNumber date day weight notes | <status value here> <phone value here> ...
 *
 * Detection: inspects col index 7 per row.
 *   — Known status value ('waiting','scheduled',etc.) → new-schema row → preserve as-is
 *   — ISO timestamp or empty                          → old-schema row → shift fields right
 *
 * TARGET schema (15 columns, matches COLUMN_MAP exactly):
 *   id name fileNumber date day weight notes status phone createdAt updatedAt deletedAt version preparedBy nextChemoAppt
 *
 * Safe to run multiple times (idempotent).
 * Trigger via GAS editor: Run → migratePortCathSchemaFull
 * Or via URL: ?action=migrate&key=YOUR_KEY
 */
function migratePortCathSchemaFull() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PortCath');
  if (!sheet) { Logger.log('ERROR: PortCath sheet not found'); return { error: 'sheet not found' }; }

  const TARGET_HEADERS = [
    'id', 'name', 'fileNumber', 'date', 'day', 'weight', 'notes',
    'status', 'phone',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy',
    'nextChemoAppt'
  ];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h || '').trim());

  Logger.log('BEFORE — headers: ' + currentHeaders.join(' | '));
  Logger.log('BEFORE — col count: ' + currentHeaders.length);

  // Already correct?
  const alreadyCorrect = TARGET_HEADERS.length === currentHeaders.length
    && TARGET_HEADERS.every((h, i) => currentHeaders[i] === h);
  if (alreadyCorrect) {
    Logger.log('✓ Schema already correct — nothing to do.');
    return { success: true, skipped: true };
  }

  // Read all data
  let allRows = [];
  if (lastRow > 1) {
    allRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  }
  Logger.log('Data rows to migrate: ' + allRows.length);

  // Status values that can ONLY appear in the status field — never in a timestamp
  const KNOWN_STATUS = new Set(['waiting', 'scheduled', 'done', 'cancelled', 'no-show', 'apologized']);

  let newSchemaCount = 0, oldSchemaCount = 0;

  const mappedRows = allRows.map(row => {
    const newRow = new Array(TARGET_HEADERS.length).fill('');

    // Columns 0–6 are identical in all schema versions
    for (let i = 0; i <= 6; i++) {
      newRow[i] = (row[i] !== undefined && row[i] !== null) ? row[i] : '';
    }

    const col7 = String(row[7] || '');
    const isNewSchema = KNOWN_STATUS.has(col7);

    if (isNewSchema) {
      // Row was written with the new GAS (status at 7, phone at 8, createdAt at 9…)
      newRow[7]  = row[7]  || 'scheduled'; // status
      newRow[8]  = row[8]  || '';          // phone
      newRow[9]  = row[9]  || '';          // createdAt
      newRow[10] = row[10] || '';          // updatedAt
      newRow[11] = row[11] || '';          // deletedAt
      newRow[12] = row[12] || '';          // version
      newRow[13] = row[13] || '';          // preparedBy
      newRow[14] = row[14] || '';          // nextChemoAppt
      newSchemaCount++;
    } else {
      // Row was written with the old GAS (no status/phone — createdAt was at index 7)
      newRow[7]  = 'scheduled';            // status   → default for old records
      newRow[8]  = '';                     // phone    → cannot recover, was never stored
      newRow[9]  = row[7]  || '';          // createdAt  (was at index 7)
      newRow[10] = row[8]  || '';          // updatedAt  (was at index 8)
      newRow[11] = row[9]  || '';          // deletedAt  (was at index 9)
      newRow[12] = row[10] || '';          // version    (was at index 10)
      newRow[13] = row[11] || '';          // preparedBy (was at index 11)
      newRow[14] = row[14] || '';          // nextChemoAppt (same position in both)
      oldSchemaCount++;
    }

    return newRow;
  });

  Logger.log('Rows detected as new-schema: ' + newSchemaCount);
  Logger.log('Rows detected as old-schema: ' + oldSchemaCount);

  // Rewrite sheet
  sheet.clearContents();
  sheet.getRange(1, 1, 1, TARGET_HEADERS.length).setValues([TARGET_HEADERS]);
  if (mappedRows.length > 0) {
    sheet.getRange(2, 1, mappedRows.length, TARGET_HEADERS.length).setValues(mappedRows);
  }

  // Validate
  const finalHeaders = sheet.getRange(1, 1, 1, TARGET_HEADERS.length).getValues()[0];
  const valid = TARGET_HEADERS.every((h, i) => finalHeaders[i] === h);

  Logger.log('AFTER  — headers: ' + finalHeaders.join(' | '));
  Logger.log('AFTER  — col count: ' + finalHeaders.length);
  Logger.log(valid
    ? '✓ Migration complete — schema validated successfully.'
    : '✗ Migration complete — but schema validation FAILED. Manual review required.');

  return { success: true, rows: mappedRows.length, newSchemaCount, oldSchemaCount, validated: valid };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateApiKey(key) {
  return VALID_API_KEYS.includes(key);
}

function createSheetWithHeaders(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const hasHeaders = existingHeaders.some(h => h !== '');
    if (!hasHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
}

function ensureSheetsExist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const sheetName of Object.values(SHEET_NAMES)) {
    if (!ss.getSheetByName(sheetName)) {
      initializeSpreadsheet();
      return;
    }
  }
}

function getSheetData(type) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const results = [];

  for (const row of data) {
    const record = rowToRecord(type, row);
    if (!isRealTimestamp(record.deletedAt)) results.push(record);
  }

  return results;
}

function isRealTimestamp(value) {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(String(value));
}

function findRowByIdInSheet(sheet, colMap, id) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1) return -1;

  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const targetId = String(id);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colMap.id]) === targetId) return i + 1;
  }
  return -1;
}

function recordToRow(type, record) {
  const colMap = COLUMN_MAP[type];
  const row = new Array(Object.keys(colMap).length);

  for (const [field, colIndex] of Object.entries(colMap)) {
    let value = record[field];

    if ((field === 'id' || field === 'fileNumber') && value !== undefined && value !== null) {
      value = String(value);
    }
    if (field === 'tasks' && Array.isArray(value)) {
      value = JSON.stringify(value);
    }
    if (field === 'isActive') {
      row[colIndex] = (value === true || value === 'true') ? 'TRUE' : 'FALSE';
      continue;
    }

    row[colIndex] = (value === null || value === undefined) ? '' : value;
  }

  return row;
}

function rowToRecord(type, row) {
  const colMap = COLUMN_MAP[type];
  const record = {};

  for (const [field, colIndex] of Object.entries(colMap)) {
    let value = (row[colIndex] !== undefined && row[colIndex] !== null) ? row[colIndex] : '';

    if (field === 'tasks') {
      try { value = value ? JSON.parse(value) : []; } catch (e) { value = []; }
    }
    if ((field === 'weight' || field === 'age' || field === 'year' || field === 'month') && value) {
      value = parseFloat(value) || value;
    }
    if (field === 'timestamp' && value) {
      value = Number(value) || value;
    }
    if (field === 'isActive') {
      value = value === 'TRUE' || value === true;
    }
    if (field === 'toDate' && value === '') {
      value = null;
    }
    if ((field === 'id' || field === 'fileNumber' || field === 'patientId') && value !== undefined && value !== null) {
      value = String(value);
    }

    record[field] = value;
  }

  return record;
}

function sanitizeForAuditLog(jsonStr) {
  if (!jsonStr) return jsonStr;
  try {
    const obj = JSON.parse(jsonStr);
    if (obj && typeof obj === 'object') delete obj.phone;
    return JSON.stringify(obj);
  } catch (e) {
    return jsonStr;
  }
}

function writeAuditLog(entry) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.audit_log);
  if (!sheet) return;

  sheet.appendRow([
    entry.timestamp || new Date().toISOString(),
    entry.action || '',
    entry.module || '',
    entry.recordId || '',
    entry.displayName || '',
    sanitizeForAuditLog(entry.beforeJson) || '',
    sanitizeForAuditLog(entry.afterJson) || ''
  ]);
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function successResponse(data) {
  const result = { status: 'ok' };
  if (data) Object.assign(result, typeof data === 'object' ? data : { data });
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpResponse(data, callback) {
  const safeCallback = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(callback || '')
    ? callback : 'callback';
  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(data)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function errorResponse(code, message, httpCode = 500) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', code, message }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHttpCode(httpCode);
}
