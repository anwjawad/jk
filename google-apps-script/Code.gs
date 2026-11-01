/**
 * MedSched — Google Apps Script backend (v2)
 *
 * Deploy as a Web App: Execute as "Me", access "Anyone".
 * Uses the same sheets and columns as v1, so existing data stays where it is.
 *
 * What changed from v1:
 *  - One "applyBatch" request saves many changes at once, under a lock, so two
 *    people saving at the same moment can't overwrite each other's rows.
 *  - Every change is an idempotent upsert: sending the same change twice is safe,
 *    and an edit that arrives before its create is not lost.
 *  - Only the fields that were sent are written; other columns are left alone.
 *  - Columns are found by their header name, and new columns are only ever
 *    added at the end, so the old app version keeps working side by side.
 *  - Cells are stored as plain text, so dates no longer shift by a day and file
 *    and phone numbers keep their leading zeros.
 *  - Errors come back as readable JSON (v1 crashed on every error path).
 *  - v1 actions (createRecord, updateRecord, deleteRecord, syncBatch, ...) still work.
 */

const VALID_API_KEYS = ['medsched-2026-key-abc123'];
const API_VERSION = 2;

// Column order used when a sheet is created. Existing sheets keep their order;
// missing columns are appended at the end.
const SHEETS = {
  portcath: { name: 'PortCath', cols: ['id', 'name', 'fileNumber', 'date', 'day', 'weight', 'notes', 'status', 'phone', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy', 'nextChemoAppt', 'doneAt', 'outcomeNote'] },
  'portcath-session-config': { name: 'PortCathSessionConfig', cols: ['id', 'date', 'year', 'month', 'dayOfWeek', 'isActive', 'syncStatus', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'] },
  'portcath-history': { name: 'PortCathHistory', appendOnly: true, cols: ['id', 'patientId', 'patientName', 'fileNumber', 'action', 'fromDate', 'toDate', 'reason', 'note', 'timestamp', 'syncStatus', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'] },
  admissions: { name: 'Admissions', cols: ['id', 'name', 'fileNumber', 'age', 'triageScore', 'primaryPhysician', 'placeOfReferral', 'modeOfTransportation', 'performanceStatus', 'admissionDepartment', 'date', 'summary', 'causeOfAdmission', 'notes', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'] },
  followup: { name: 'FollowUp', cols: ['id', 'name', 'phone', 'fileNumber', 'date', 'task', 'taskResult', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'] },
  tumorboard: { name: 'TumorBoard', cols: ['id', 'name', 'fileNumber', 'age', 'physician', 'diagnosis', 'notes', 'tasks', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'preparedBy'] },
  clinic: { name: 'ClinicAppointments', cols: ['id', 'name', 'fileNumber', 'age', 'date', 'primaryPhysician', 'case', 'causeOfAdmission', 'note', 'createdAt', 'updatedAt', 'deletedAt', 'version'] },
};
const GETALL_KEYS = { portcath: 'portcath', admissions: 'admissions', followup: 'followup', tumorboard: 'tumorboard', clinic: 'clinic', 'portcath-session-config': 'portcathSessionConfig', 'portcath-history': 'portcathHistory' };
const DATE_FIELDS = { date: 1, nextChemoAppt: 1, fromDate: 1, toDate: 1, doneAt: 1 };
const STAMP_FIELDS = { createdAt: 1, updatedAt: 1, deletedAt: 1 };
const AUDIT_SHEET = 'AuditLog';
const SETTINGS_SHEET = 'Settings';

// ============================================================================
// HTTP
// ============================================================================

function doGet(e) {
  const p = (e && e.parameter) || {};
  const out = handle(function () {
    if (!validKey(p.key)) throw new Error('Wrong access key.');
    switch (p.action) {
      case 'ping': return { version: API_VERSION };
      case 'getAll': return getAll();
      case 'getSettings': return readSettings();
      case 'getByDate': return { records: getRows(p.type).filter(function (r) { return r.date === p.date; }) };
      case 'setup': ensureAll(); return { message: 'Sheets are ready.' };
      default: throw new Error('Unknown action: ' + p.action);
    }
  });
  if (p.callback && /^[A-Za-z_$][\w$]*$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + JSON.stringify(out) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json(out);
}

function doPost(e) {
  return json(handle(function () {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!validKey(body.key)) throw new Error('Wrong access key.');
    const who = String(body.displayName || '');
    switch (body.action) {
      case 'applyBatch': return applyOps(body.ops || [], who);
      // v1 actions, kept for app versions that are still open somewhere.
      case 'createRecord':
      case 'updateRecord': return applyOps([{ op: 'upsert', type: body.type, record: body.record }], who);
      case 'deleteRecord': return applyOps([{ op: 'delete', type: body.type, id: body.id }], who);
      case 'syncBatch': return applyOps((body.operations || []).map(function (o) { return { op: 'upsert', type: body.type, record: o.record }; }), who);
      case 'clearType': return clearType(body.type, who);
      case 'writeSetting': return writeSetting(body.settingKey, body.value);
      case 'writeAuditLog': appendAudit([[new Date().toISOString(), body.action || '', body.module || '', body.recordId || '', who, '', '']]); return {};
      default: throw new Error('Unknown action: ' + body.action);
    }
  }));
}

function handle(fn) {
  try {
    const data = fn() || {};
    data.status = 'ok';
    data.version = API_VERSION;
    return data;
  } catch (err) {
    return { status: 'error', message: String(err && err.message || err), version: API_VERSION };
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function validKey(key) { return VALID_API_KEYS.indexOf(String(key || '')) > -1; }

// ============================================================================
// SHEETS
// ============================================================================

function spreadsheet() { return SpreadsheetApp.getActiveSpreadsheet(); }

// Returns { sheet, headers, index: {field: col} }, creating the sheet or the
// missing columns when needed. Data columns are formatted as plain text.
function table(type) {
  const def = SHEETS[type];
  if (!def) throw new Error('Unknown list: ' + type);
  const ss = spreadsheet();
  let sheet = ss.getSheetByName(def.name);
  if (!sheet) sheet = ss.insertSheet(def.name);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  if (headers.every(function (h) { return !h; })) headers = [];
  const missing = def.cols.filter(function (c) { return headers.indexOf(c) === -1; });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
  }
  // Text format keeps "0599…" and "00123" as typed and stops notes like "3/4"
  // turning into dates. Date columns keep their format: dates already stored
  // there are real dates and are read back with the sheet's time zone.
  const textFormatKey = 'textFormat:' + def.name + ':' + headers.length;
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(textFormatKey)) {
    headers.forEach(function (h, i) {
      if (h && !DATE_FIELDS[h] && !STAMP_FIELDS[h]) sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
    });
    props.setProperty(textFormatKey, '1');
  }
  const index = {};
  headers.forEach(function (h, i) { if (h && !(h in index)) index[h] = i; });
  return { sheet: sheet, headers: headers, index: index, def: def };
}

function ensureAll() {
  Object.keys(SHEETS).forEach(table);
  if (!spreadsheet().getSheetByName(AUDIT_SHEET)) spreadsheet().insertSheet(AUDIT_SHEET).appendRow(['timestamp', 'action', 'module', 'recordId', 'displayName', 'beforeJson', 'afterJson']);
  if (!spreadsheet().getSheetByName(SETTINGS_SHEET)) spreadsheet().insertSheet(SETTINGS_SHEET).appendRow(['key', 'value', 'updatedAt']);
}

const TZ = function () { return spreadsheet().getSpreadsheetTimeZone(); };

// Cell → text. Date cells written by v1 come back as Date objects.
function cellOut(field, v, tz) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v)) return '';
    return DATE_FIELDS[field] ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
  }
  return v;
}

function rowToRecord(t, row, tz) {
  const r = {};
  t.headers.forEach(function (h, i) { if (h) r[h] = cellOut(h, row[i], tz); });
  if (r.tasks !== undefined && r.tasks !== '') { try { r.tasks = JSON.parse(r.tasks); } catch (e) { r.tasks = []; } }
  ['id', 'fileNumber', 'phone', 'patientId'].forEach(function (k) { if (r[k] !== undefined) r[k] = String(r[k]); });
  return r;
}

function isDeleted(r) { return !!r.deletedAt && /^\d{4}-\d{2}-\d{2}/.test(String(r.deletedAt)); }

function getRows(type) {
  const t = table(type);
  const last = t.sheet.getLastRow();
  if (last < 2) return [];
  const tz = TZ();
  return t.sheet.getRange(2, 1, last - 1, t.headers.length).getValues()
    .map(function (row) { return rowToRecord(t, row, tz); })
    .filter(function (r) { return r.id && !isDeleted(r); });
}

function getAll() {
  const out = {};
  Object.keys(SHEETS).forEach(function (type) { out[GETALL_KEYS[type]] = getRows(type); });
  out.settings = readSettings();
  return out;
}

// ============================================================================
// WRITES
// ============================================================================

function toCell(field, v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  if (field === 'isActive') return (v === true || v === 'true' || v === 'TRUE') ? 'TRUE' : 'FALSE';
  return String(v);
}

function stripPhone(obj) {
  if (!obj) return '';
  const copy = {};
  Object.keys(obj).forEach(function (k) { if (k !== 'phone') copy[k] = obj[k]; });
  return JSON.stringify(copy);
}

// ops: [{ op: 'upsert'|'delete', type, record?, id? }]
function applyOps(ops, who) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const now = new Date().toISOString();
    const tz = TZ();
    const audit = [];
    const byType = {};
    ops.forEach(function (o) { (byType[o.type] = byType[o.type] || []).push(o); });
    let applied = 0;
    Object.keys(byType).forEach(function (type) {
      const t = table(type);
      const width = t.headers.length;
      const last = t.sheet.getLastRow();
      const data = last > 1 ? t.sheet.getRange(2, 1, last - 1, width).getValues() : [];
      const rowOf = {};
      const idCol = t.index.id;
      data.forEach(function (row, i) { const id = String(row[idCol] || ''); if (id) rowOf[id] = i; });
      const dirty = {};
      const added = [];
      byType[type].forEach(function (o) {
        const id = String(o.op === 'delete' ? o.id : (o.record && o.record.id) || '');
        if (!id) return;
        let i = rowOf[id];
        let row = i === undefined ? null : data[i];
        if (!row) {
          i = added.findIndex(function (r) { return String(r[idCol]) === id; });
          row = i > -1 ? added[i] : null;
          if (row) i = 'new' + i;
        }
        const before = row ? rowToRecord(t, row, tz) : null;
        if (o.op === 'delete') {
          if (!row || t.def.appendOnly) { applied++; return; }
          setField(t, row, 'deletedAt', now);
        } else {
          if (row && t.def.appendOnly) { applied++; return; }
          if (!row) {
            row = new Array(width).fill('');
            added.push(row);
            setField(t, row, 'createdAt', o.record.createdAt || now);
            setField(t, row, 'version', 0);
          }
          Object.keys(o.record).forEach(function (k) {
            if (k === 'version' || k === 'updatedAt' || k === 'preparedBy' || k === 'createdAt') return;
            if (k in t.index) setField(t, row, k, o.record[k]);
          });
          if (!o.record.deletedAt) setField(t, row, 'deletedAt', '');
        }
        setField(t, row, 'updatedAt', now);
        setField(t, row, 'version', (Number(row[t.index.version]) || 0) + 1);
        if (who) setField(t, row, 'preparedBy', who);
        if (typeof i === 'number' && i > -1) dirty[i] = true;
        audit.push([now, before ? (o.op === 'delete' ? 'DELETE' : 'UPDATE') : 'CREATE', type, id, who, stripPhone(before), o.op === 'delete' ? '' : stripPhone(rowToRecord(t, row, tz))]);
        applied++;
      });
      Object.keys(dirty).forEach(function (i) {
        t.sheet.getRange(Number(i) + 2, 1, 1, width).setValues([data[i]]);
      });
      if (added.length) t.sheet.getRange(t.sheet.getLastRow() + 1, 1, added.length, width).setValues(added);
    });
    if (audit.length) appendAudit(audit);
    return { applied: applied };
  } finally {
    lock.releaseLock();
  }
}

function setField(t, row, field, value) {
  if (field in t.index) row[t.index[field]] = toCell(field, value);
}

function clearType(type, who) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const t = table(type);
    const last = t.sheet.getLastRow();
    if (last < 2) return { cleared: 0 };
    const now = new Date().toISOString();
    const data = t.sheet.getRange(2, 1, last - 1, t.headers.length).getValues();
    let n = 0;
    data.forEach(function (row) {
      if (row[t.index.id] && !row[t.index.deletedAt]) { row[t.index.deletedAt] = now; row[t.index.updatedAt] = now; n++; }
    });
    t.sheet.getRange(2, 1, data.length, t.headers.length).setValues(data);
    appendAudit([[now, 'CLEAR', type, '', who, '', String(n)]]);
    return { cleared: n };
  } finally {
    lock.releaseLock();
  }
}

function appendAudit(rows) {
  let sheet = spreadsheet().getSheetByName(AUDIT_SHEET);
  if (!sheet) { sheet = spreadsheet().insertSheet(AUDIT_SHEET); sheet.appendRow(['timestamp', 'action', 'module', 'recordId', 'displayName', 'beforeJson', 'afterJson']); }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
}

// ============================================================================
// SETTINGS
// ============================================================================

function readSettings() {
  const sheet = spreadsheet().getSheetByName(SETTINGS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const out = {};
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (r) { if (r[0]) out[r[0]] = r[1]; });
  return out;
}

function writeSetting(key, value) {
  if (!key) throw new Error('A setting name is required.');
  let sheet = spreadsheet().getSheetByName(SETTINGS_SHEET);
  if (!sheet) { sheet = spreadsheet().insertSheet(SETTINGS_SHEET); sheet.appendRow(['key', 'value', 'updatedAt']); }
  const now = new Date().toISOString();
  const last = sheet.getLastRow();
  const keys = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues() : [];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i][0] === key) { sheet.getRange(i + 2, 2, 1, 2).setValues([[String(value), now]]); return { key: key }; }
  }
  sheet.appendRow([key, String(value), now]);
  return { key: key };
}
