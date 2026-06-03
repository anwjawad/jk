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
  audit_log: 'AuditLog',
  settings: 'Settings'
};

// Column indices (A=0, B=1, etc.)
const COLUMN_MAP = {
  portcath: {
    id: 0, name: 1, fileNumber: 2, date: 3, day: 4, weight: 5, notes: 6,
    createdAt: 7, updatedAt: 8, deletedAt: 9, version: 10, preparedBy: 11
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
  }
};

const AUDIT_LOG_COLUMNS = {
  timestamp: 0,
  action: 1,
  module: 2,
  recordId: 3,
  displayName: 4,
  beforeJson: 5,
  afterJson: 6
};

// ============================================================================
// HTTP HANDLERS
// ============================================================================

/**
 * Handle GET requests (read operations)
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const key = e.parameter.key;

    if (!validateApiKey(key)) {
      return errorResponse('INVALID_KEY', 'Authentication failed', 403);
    }

    switch (action) {
      case 'setup':
        // Initialize/create all sheets and headers
        initializeSpreadsheet();
        return successResponse({ status: 'ok', message: 'Spreadsheet initialized' });

      case 'getAll':
        // Auto-initialize if needed
        ensureSheetsExist();
        return successResponse(getAllData());

      case 'getByDate':
        const type = e.parameter.type;
        const date = e.parameter.date;
        if (!type || !date) {
          return errorResponse('MISSING_PARAMS', 'type and date required', 400);
        }
        ensureSheetsExist();
        return successResponse(getByDate(type, date));

      case 'getSettings':
        ensureSheetsExist();
        return successResponse(getSettings());

      default:
        return errorResponse('INVALID_ACTION', `Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', err.toString(), 500);
  }
}

/**
 * Handle POST requests (write operations)
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const key = payload.key;

    if (!validateApiKey(key)) {
      return errorResponse('INVALID_KEY', 'Authentication failed', 403);
    }

    const action = payload.action;

    switch (action) {
      case 'createRecord':
        return createRecordHandler(payload);

      case 'updateRecord':
        return updateRecordHandler(payload);

      case 'deleteRecord':
        return deleteRecordHandler(payload);

      case 'syncBatch':
        return syncBatchHandler(payload);

      case 'writeAuditLog':
        return writeAuditLogHandler(payload);

      case 'writeSetting':
        return writeSettingHandler(payload);

      case 'clearType':
        return clearTypeHandler(payload);

      default:
        return errorResponse('INVALID_ACTION', `Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', err.toString(), 500);
  }
}

// ============================================================================
// ACTION HANDLERS (POST)
// ============================================================================

/**
 * Create a new record
 * Payload: { type, record, displayName }
 */
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
  if (!sheet) {
    return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);
  }

  // Check for duplicate
  const existingRow = findRowByIdInSheet(sheet, COLUMN_MAP[type], record.id);
  if (existingRow > 0) {
    return errorResponse('DUPLICATE_RECORD', `Record ${record.id} already exists`, 409);
  }

  // Add timestamps
  const now = new Date().toISOString();
  record.createdAt = record.createdAt || now;
  record.updatedAt = now;
  record.deletedAt = null;
  record.version = 1;
  record.preparedBy = displayName;

  // Convert to row and append
  const row = recordToRow(type, record);
  sheet.appendRow(row);

  // Audit log
  writeAuditLog({
    timestamp: now,
    action: 'CREATE',
    module: type,
    recordId: record.id,
    displayName: displayName,
    beforeJson: null,
    afterJson: JSON.stringify(record)
  });

  return successResponse({ status: 'ok', id: record.id });
}

/**
 * Update an existing record
 * Payload: { type, record, displayName }
 */
function updateRecordHandler(payload) {
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
  if (!sheet) {
    return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);
  }

  const rowIndex = findRowByIdInSheet(sheet, COLUMN_MAP[type], record.id);
  if (rowIndex <= 0) {
    return errorResponse('NOT_FOUND', `Record ${record.id} not found`, 404);
  }

  // Get before state
  const beforeRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const beforeRecord = rowToRecord(type, beforeRow);

  // Update timestamps
  const now = new Date().toISOString();
  record.updatedAt = now;
  record.createdAt = record.createdAt || beforeRecord.createdAt;
  record.version = (record.version || 0) + 1;
  record.preparedBy = displayName;

  // Convert to row and overwrite
  const newRow = recordToRow(type, record);
  sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);

  // Audit log
  writeAuditLog({
    timestamp: now,
    action: 'UPDATE',
    module: type,
    recordId: record.id,
    displayName: displayName,
    beforeJson: JSON.stringify(beforeRecord),
    afterJson: JSON.stringify(record)
  });

  return successResponse({ status: 'ok', updated: true });
}

/**
 * Soft delete a record (set deletedAt timestamp)
 * Payload: { type, id, displayName }
 */
function deleteRecordHandler(payload) {
  const type = payload.type;
  const id = payload.id !== undefined && payload.id !== null ? String(payload.id) : '';
  const displayName = payload.displayName || 'Unknown';

  if (!type || !id) {
    return errorResponse('MISSING_PARAMS', 'type and id required', 400);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) {
    return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);
  }

  const rowIndex = findRowByIdInSheet(sheet, COLUMN_MAP[type], id);
  if (rowIndex <= 0) {
    return errorResponse('NOT_FOUND', `Record ${id} not found`, 404);
  }

  // Get before state
  const beforeRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const beforeRecord = rowToRecord(type, beforeRow);

  // Soft delete: set deletedAt
  const now = new Date().toISOString();
  beforeRecord.deletedAt = now;
  beforeRecord.updatedAt = now;
  beforeRecord.version = (beforeRecord.version || 0) + 1;
  beforeRecord.preparedBy = displayName;

  const newRow = recordToRow(type, beforeRecord);
  sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);

  // Audit log
  writeAuditLog({
    timestamp: now,
    action: 'DELETE',
    module: type,
    recordId: id,
    displayName: displayName,
    beforeJson: JSON.stringify(beforeRecord),
    afterJson: JSON.stringify(beforeRecord)
  });

  return successResponse({ status: 'ok', deleted: true });
}

/**
 * Clear all records in a type (soft delete with timestamp)
 * Payload: { type }
 */
function clearTypeHandler(payload) {
  const type = payload.type;
  if (!type || !SHEET_NAMES[type]) {
    return errorResponse('MISSING_PARAMS', 'valid type required', 400);
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return successResponse({ cleared: 0 });

  const now      = new Date().toISOString();
  const colMap   = COLUMN_MAP[type];
  const numCols  = sheet.getLastColumn();
  const data     = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  let cleared    = 0;

  data.forEach((row, i) => {
    if (row[colMap.id] && !row[colMap.deletedAt]) {
      sheet.getRange(i + 2, colMap.deletedAt + 1).setValue(now);
      sheet.getRange(i + 2, colMap.updatedAt + 1).setValue(now);
      cleared++;
    }
  });

  return successResponse({ cleared });
}

/**
 * Batch sync operation (bulk create/update multiple records)
 * Payload: { type, operations: [{op, record}], displayName }
 * op: 'create' | 'update'
 */
function syncBatchHandler(payload) {
  const type = payload.type;
  const operations = payload.operations || [];
  const displayName = payload.displayName || 'Unknown';

  if (!type || !Array.isArray(operations)) {
    return errorResponse('MISSING_PARAMS', 'type and operations array required', 400);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) {
    return errorResponse('SHEET_NOT_FOUND', `Sheet ${type} not found`, 404);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const op of operations) {
    const record = op.record;
    if (!record.id) {
      skipped++;
      continue;
    }

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

      const row = recordToRow(type, record);
      sheet.appendRow(row);
      inserted++;

      writeAuditLog({
        timestamp: now,
        action: 'BATCH_CREATE',
        module: type,
        recordId: record.id,
        displayName: displayName,
        beforeJson: null,
        afterJson: JSON.stringify(record)
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
        timestamp: now,
        action: 'BATCH_UPDATE',
        module: type,
        recordId: record.id,
        displayName: displayName,
        beforeJson: JSON.stringify(beforeRecord),
        afterJson: JSON.stringify(record)
      });
    } else {
      skipped++;
    }
  }

  return successResponse({ status: 'ok', inserted, updated, skipped });
}

/**
 * Write audit log entry
 * Payload: { timestamp, action, module, recordId, displayName, beforeJson, afterJson }
 */
function writeAuditLogHandler(payload) {
  writeAuditLog(payload);
  return successResponse({ status: 'ok' });
}

/**
 * Write or update a setting
 * Payload: { key, value }
 */
function writeSettingHandler(payload) {
  const key = payload.key;
  const value = payload.value;

  if (!key) {
    return errorResponse('MISSING_PARAMS', 'key required', 400);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.settings);
  if (!sheet) {
    return errorResponse('SHEET_NOT_FOUND', 'Settings sheet not found', 404);
  }

  const data = sheet.getRange('A:B').getValues();
  let found = false;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      const now = new Date().toISOString();
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 3).setValue(now);
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([key, value, new Date().toISOString()]);
  }

  return successResponse({ status: 'ok', key, value });
}

// ============================================================================
// ACTION HANDLERS (GET)
// ============================================================================

/**
 * Get all data from all four data sheets (excluding soft-deleted records)
 */
function getAllData() {
  return {
    portcath: getSheetData('portcath'),
    admissions: getSheetData('admissions'),
    followup: getSheetData('followup'),
    tumorboard: getSheetData('tumorboard')
  };
}

/**
 * Get records by date (for a specific module)
 */
function getByDate(type, date) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) {
    throw new Error(`Sheet ${type} not found`);
  }

  const data = sheet.getRange('A2:' + String.fromCharCode(65 + sheet.getLastColumn() - 1) + sheet.getLastRow()).getValues();
  const colMap = COLUMN_MAP[type];
  const results = [];

  for (const row of data) {
    const record = rowToRecord(type, row);
    // Exclude soft-deleted records
    if (record.deletedAt) continue;
    // Match date
    if (record.date === date) {
      results.push(record);
    }
  }

  return results;
}

/**
 * Get all settings
 */
function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.settings);
  if (!sheet) {
    return {};
  }

  const data = sheet.getRange('A2:B' + sheet.getLastRow()).getValues();
  const result = {};

  for (const row of data) {
    if (row[0]) {
      result[row[0]] = row[1];
    }
  }

  return result;
}

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize the spreadsheet by creating all required sheets and headers
 * Call this manually via: ?action=setup&key=YOUR_KEY
 * Or it runs automatically on first data access
 */
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create PortCath sheet
  createSheetWithHeaders('PortCath', [
    'id', 'name', 'fileNumber', 'date', 'day', 'weight', 'notes',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);

  // Create Admissions sheet
  createSheetWithHeaders('Admissions', [
    'id', 'name', 'fileNumber', 'age', 'triageScore', 'primaryPhysician',
    'placeOfReferral', 'modeOfTransportation', 'performanceStatus',
    'admissionDepartment', 'date', 'summary', 'causeOfAdmission', 'notes',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);

  // Create FollowUp sheet
  createSheetWithHeaders('FollowUp', [
    'id', 'name', 'phone', 'fileNumber', 'date', 'task', 'taskResult',
    'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);

  // Create TumorBoard sheet
  createSheetWithHeaders('TumorBoard', [
    'id', 'name', 'fileNumber', 'age', 'physician', 'diagnosis', 'notes',
    'tasks', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'
  ]);

  // Create AuditLog sheet
  createSheetWithHeaders('AuditLog', [
    'timestamp', 'action', 'module', 'recordId', 'displayName', 'beforeJson', 'afterJson'
  ]);

  // Create Settings sheet
  createSheetWithHeaders('Settings', [
    'key', 'value', 'updatedAt'
  ]);

  // Add initial settings
  const settingsSheet = ss.getSheetByName('Settings');
  const settingsData = settingsSheet.getRange('A2:A').getValues();
  let hasSchemaVersion = false;

  for (const row of settingsData) {
    if (row[0] === 'schemaVersion') {
      hasSchemaVersion = true;
      break;
    }
  }

  if (!hasSchemaVersion) {
    settingsSheet.appendRow(['schemaVersion', '1.0.0', new Date().toISOString()]);
    settingsSheet.appendRow(['appName', 'MedSched Panel', new Date().toISOString()]);
  }
}

/**
 * Create a sheet with headers if it doesn't exist
 */
function createSheetWithHeaders(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    // Sheet doesn't exist, create it
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  } else {
    // Sheet exists, check if it has headers
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const hasHeaders = existingHeaders.some(h => h !== '');

    if (!hasHeaders) {
      // No headers, add them
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
}

/**
 * Ensure all required sheets exist (called on every data access)
 */
function ensureSheetsExist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = Object.values(SHEET_NAMES);

  for (const sheetName of requiredSheets) {
    if (!ss.getSheetByName(sheetName)) {
      // Missing sheet, trigger full initialization
      initializeSpreadsheet();
      return;
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate API key
 */
function validateApiKey(key) {
  return VALID_API_KEYS.includes(key);
}

/**
 * Get all data from a sheet (excluding soft-deleted records)
 */
function getSheetData(type) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[type]);
  if (!sheet) {
    return [];
  }

  const data = sheet.getRange('A2:' + String.fromCharCode(65 + sheet.getLastColumn() - 1) + sheet.getLastRow()).getValues();
  const results = [];

  for (const row of data) {
    const record = rowToRecord(type, row);
    // Exclude soft-deleted records from normal queries
    if (!record.deletedAt) {
      results.push(record);
    }
  }

  return results;
}

/**
 * Find row index by ID in a sheet
 * Returns row number (1-based, including header), or -1 if not found
 */
function findRowByIdInSheet(sheet, colMap, id) {
  const data = sheet.getRange('A1:' + String.fromCharCode(65 + sheet.getLastColumn() - 1) + sheet.getLastRow()).getValues();
  const idColIndex = colMap.id;
  const targetId = String(id);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]) === targetId) {
      return i + 1; // Return 1-based row number
    }
  }

  return -1;
}

/**
 * Convert a record object to a row array
 */
function recordToRow(type, record) {
  const colMap = COLUMN_MAP[type];
  const row = new Array(Object.keys(colMap).length);

  for (const [field, colIndex] of Object.entries(colMap)) {
    let value = record[field];

    if ((field === 'id' || field === 'fileNumber') && value !== undefined && value !== null) {
      value = String(value);
    }

    // Special handling for tasks (JSON string for tumorboard)
    if (field === 'tasks' && Array.isArray(value)) {
      value = JSON.stringify(value);
    }

    row[colIndex] = value || '';
  }

  return row;
}

/**
 * Convert a row array to a record object
 */
function rowToRecord(type, row) {
  const colMap = COLUMN_MAP[type];
  const record = {};

  for (const [field, colIndex] of Object.entries(colMap)) {
    let value = row[colIndex] || '';

    // Special handling for tasks (parse JSON string)
    if (field === 'tasks') {
      try {
        value = value ? JSON.parse(value) : [];
      } catch (e) {
        value = [];
      }
    }

    // Parse numeric fields
    if ((field === 'weight' || field === 'age') && value) {
      value = parseFloat(value) || value;
    }

    if ((field === 'id' || field === 'fileNumber') && value !== undefined && value !== null) {
      value = String(value);
    }

    record[field] = value;
  }

  return record;
}

/**
 * Write an entry to the audit log
 */
function writeAuditLog(entry) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.audit_log);
  if (!sheet) {
    return;
  }

  const row = [
    entry.timestamp || new Date().toISOString(),
    entry.action || '',
    entry.module || '',
    entry.recordId || '',
    entry.displayName || '',
    entry.beforeJson || '',
    entry.afterJson || ''
  ];

  sheet.appendRow(row);
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Generate success response
 */
function successResponse(data) {
  const result = { status: 'ok' };
  if (data) {
    Object.assign(result, typeof data === 'object' ? data : { data });
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Generate error response
 */
function errorResponse(code, message, httpCode = 500) {
  const result = {
    status: 'error',
    code: code,
    message: message
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
    .setHttpCode(httpCode);
}
