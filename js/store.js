// Single source of truth in the browser.
// - Every change is applied locally first and queued in an outbox.
// - The outbox is sent in order, in batches; a failed batch stays queued and is
//   retried with back-off, so nothing typed is ever dropped.
// - Loading from the sheet replaces local rows with the server's and then
//   re-applies everything still queued, so unsent edits never disappear.
import { api, TABLES } from './api.js';
import { uid, nowISO, normDate, fixMojibake, cleanText } from './util.js';

export const TABLE_NAMES = Object.keys(TABLES);
const CACHE_KEY = 'jk.v2.cache';
const DATE_FIELDS = ['date', 'nextChemoAppt', 'doneAt', 'fromDate', 'toDate'];

export const store = {
  data: emptyData(),
  version: 0,
  serverSettings: {},
  status: { state: 'idle', pending: 0, lastSync: null, error: '', server: 0 },
};

let outbox = [];
let inflight = [];
let serverIds = emptyIds();
let flushTimer = null;
let retryDelay = 0;
const listeners = new Set();

function emptyData() { return Object.fromEntries(TABLE_NAMES.map((t) => [t, {}])); }
function emptyIds() { return Object.fromEntries(TABLE_NAMES.map((t) => [t, new Set()])); }

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let batchDepth = 0;
let batchDirty = false;
function changed() {
  if (batchDepth > 0) { batchDirty = true; return; }
  store.version++;
  persistSoon();
  listeners.forEach((fn) => fn({}));
}

// Groups many writes into one re-render.
export function batch(fn) {
  batchDepth++;
  try { return fn(); } finally {
    batchDepth--;
    if (batchDepth === 0 && batchDirty) { batchDirty = false; changed(); }
  }
}

function setStatus(patch) {
  Object.assign(store.status, patch, { pending: outbox.length + inflight.length, server: api.version });
  listeners.forEach((fn) => fn({ statusOnly: true }));
}

// ---------- row decoding: whatever the sheet sends → clean records ----------
const isTrue = (v) => v === true || v === 1 || /^(true|1|yes)$/i.test(String(v ?? ''));

export function decode(table, r) {
  const out = {};
  for (const [k, v] of Object.entries(r || {})) out[k] = v == null ? '' : v;
  out.id = String(out.id ?? '').trim();
  for (const k of ['name', 'fileNumber', 'phone', 'patientName']) if (k in out) out[k] = cleanText(out[k]).replace(/\.0$/, '');
  // Phone numbers saved as numbers by the old script lost their leading zero.
  if (/^5\d{8}$/.test(out.phone || '')) out.phone = '0' + out.phone;
  for (const k of DATE_FIELDS) if (k in out) out[k] = normDate(out[k]);
  if (table === 'portcath') {
    out.status = String(out.status || '').trim().toLowerCase();
    if (!out.status) out.status = out.date ? 'confirmed' : 'waiting';
  }
  if (table === 'sessions') out.isActive = isTrue(out.isActive);
  if (table === 'history') { out.timestamp = Number(out.timestamp) || Date.parse(out.createdAt) || 0; out.patientId = String(out.patientId ?? ''); }
  if (table === 'tumorboard') {
    let tasks = out.tasks;
    if (typeof tasks === 'string') { try { tasks = tasks ? JSON.parse(tasks) : []; } catch { tasks = []; } }
    out.tasks = (Array.isArray(tasks) ? tasks : []).map((t) => ({ ...t, id: String(t.id ?? uid()), title: fixMojibake(t.title), notes: fixMojibake(t.notes) }));
  }
  return out;
}

// Local-only fields start with "_" and are never sent.
function encode(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) if (!k.startsWith('_')) out[k] = v;
  return out;
}

// ---------- persistence ----------
let persistTimer;
function persistSoon() { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 250); }
function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      mode: api.mode(),
      data: store.data,
      outbox: [...inflight, ...outbox],
      serverIds: Object.fromEntries(TABLE_NAMES.map((t) => [t, [...serverIds[t]]])),
      lastSync: store.status.lastSync,
      serverSettings: store.serverSettings,
    }));
  } catch (e) { console.warn('Cache write failed', e); }
}

export function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.mode === api.mode()) {
      store.data = { ...emptyData(), ...c.data };
      outbox = c.outbox || [];
      for (const t of TABLE_NAMES) serverIds[t] = new Set(c.serverIds?.[t] || []);
      store.status.lastSync = c.lastSync;
      store.serverSettings = c.serverSettings || {};
    } else if (!c && api.mode() === 'remote') {
      importV1Cache();
    } else return false;
    store.status.pending = outbox.length;
    store.version++;
    if (outbox.length) scheduleFlush(50);
    return true;
  } catch (e) { console.warn(e); return false; }
}

// First start after the redesign: show what the old version had cached and keep
// any of its changes that never reached the sheet.
function importV1Cache() {
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const lists = { portcath: 'medsched_portcath', admissions: 'medsched_admissions', followup: 'medsched_followup', tumorboard: 'medsched_tumorboard', sessions: 'portcath_session_config', history: 'portcath_action_history', clinic: 'medsched_clinic' };
  for (const [t, k] of Object.entries(lists)) {
    for (const r of read(k) || []) { const d = decode(t, r); if (d.id) store.data[t][d.id] = d; }
  }
  const typeToTable = Object.fromEntries(Object.entries(TABLES).map(([t, d]) => [d.type, t]));
  for (const q of read('medsched_pending_queue') || []) {
    const t = typeToTable[q.type];
    if (!t) continue;
    if (q.action === 'create' || q.action === 'update') enqueue({ kind: 'upsert', table: t, record: encode(decode(t, q.payload)) });
    else if (q.action === 'delete') enqueue({ kind: 'delete', table: t, id: String(q.payload) });
    else if (q.action === 'bulkCreate') for (const r of q.payload || []) enqueue({ kind: 'upsert', table: t, record: encode(decode(t, r)) });
  }
  for (const q of read('medsched_clinic_pending') || []) {
    if (q.action === 'createRecord' || q.action === 'updateRecord') enqueue({ kind: 'upsert', table: 'clinic', record: encode(decode('clinic', q.payload?.record)) });
    else if (q.action === 'deleteRecord') enqueue({ kind: 'delete', table: 'clinic', id: String(q.payload?.id) });
  }
}

export function resetCache() {
  localStorage.removeItem(CACHE_KEY);
  store.data = emptyData();
  outbox = []; inflight = []; serverIds = emptyIds();
  store.status.lastSync = null;
  changed();
}

// ---------- mutations ----------
function enqueue(op) {
  if (op.kind === 'upsert') {
    const i = outbox.findIndex((o) => o.kind === 'upsert' && o.table === op.table && o.record.id === op.record.id);
    if (i > -1) { outbox[i] = op; return; }
  }
  if (op.kind === 'delete' && !serverIds[op.table].has(op.id) && !inflight.some((o) => o.record?.id === op.id || o.id === op.id)) {
    // The row never reached the sheet: forget it instead of sending create + delete.
    const before = outbox.length;
    outbox = outbox.filter((o) => !(o.table === op.table && (o.record?.id === op.id || o.id === op.id)));
    if (outbox.length !== before) return;
  }
  outbox.push(op);
}

function queued(op) {
  enqueue(op);
  setStatus({ state: 'saving' });
  scheduleFlush();
}

export function upsert(table, patch) {
  const prev = store.data[table][patch.id];
  const row = { ...(prev || {}), ...patch, updatedAt: nowISO() };
  if (!prev) row.createdAt = row.createdAt || row.updatedAt;
  store.data[table][row.id] = row;
  queued({ kind: 'upsert', table, record: encode(row) });
  changed();
  return row;
}

export const create = (table, fields) => upsert(table, { id: uid(), ...fields });

// Returns the removed row so the caller can offer "Undo".
export function remove(table, id) {
  const prev = store.data[table][id];
  if (!prev) return null;
  delete store.data[table][id];
  queued({ kind: 'delete', table, id });
  changed();
  return prev;
}
export const restore = (table, row) => upsert(table, { ...row, deletedAt: '' });

// ---------- server I/O ----------
const known = (table, id) => serverIds[table].has(id);

function scheduleFlush(ms = 400) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

export async function flush() {
  if (inflight.length || !outbox.length) return;
  inflight = outbox.splice(0, api.version >= 2 ? 150 : 25);
  setStatus({ state: 'saving' });
  try {
    const applied = await api.apply(inflight, known);
    for (const o of inflight.slice(0, applied)) if (o.kind === 'upsert') serverIds[o.table].add(o.record.id);
    outbox = [...inflight.slice(applied), ...outbox];
    inflight = [];
    retryDelay = 0;
    persist();
    if (outbox.length) { scheduleFlush(30); return; }
    setStatus({ state: 'saved', error: '' });
  } catch (e) {
    // Put the batch back, unless a newer edit of the same row is already queued.
    const back = inflight.filter((o) => !(o.kind === 'upsert' && outbox.some((q) => q.kind === 'upsert' && q.table === o.table && q.record.id === o.record.id)));
    outbox = [...back, ...outbox];
    inflight = [];
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 4000, 60000);
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: e.message });
    persist();
    scheduleFlush(retryDelay);
  }
}

let syncing = null;
export function sync() {
  syncing ||= doSync().finally(() => { syncing = null; });
  return syncing;
}

async function doSync() {
  setStatus({ state: 'syncing' });
  try {
    if (outbox.length) await flush();
    const res = await api.load();
    const next = emptyData();
    for (const t of TABLE_NAMES) {
      for (const r of res.tables[t] || []) {
        const d = decode(t, r);
        if (!d.id) continue;
        next[t][d.id] = d;
        serverIds[t].add(d.id);
      }
    }
    for (const op of [...inflight, ...outbox]) {
      if (op.kind === 'upsert') next[op.table][op.record.id] = decode(op.table, op.record);
      else delete next[op.table][op.id];
    }
    store.data = next;
    store.serverSettings = res.settings || {};
    setStatus({ state: outbox.length ? 'saving' : 'saved', lastSync: nowISO(), error: '' });
    changed();
  } catch (e) {
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: e.message });
    throw e;
  }
}

export const pendingCount = () => outbox.length + inflight.length;
export const get = (t, id) => store.data[t][id];
export const all = (t) => Object.values(store.data[t]);
