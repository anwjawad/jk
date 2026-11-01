// Transport to the Google Sheet (Apps Script web app), or to a demo database
// kept in this browser.
//
// Two server versions exist:
//  v2 (google-apps-script/Code.gs in this repo): one "applyBatch" call per save,
//     each change is an idempotent upsert run under a lock, answers are readable.
//  v1 (the script deployed before the redesign): one call per record with
//     createRecord / updateRecord / deleteRecord. Still supported so nothing breaks
//     before the new script is deployed.
import { settings, DEFAULT_API_URL, DEFAULT_API_KEY } from './settings.js';

// store table → sheet "type" used by the server, and the key it uses in getAll.
export const TABLES = {
  portcath: { type: 'portcath', key: 'portcath' },
  sessions: { type: 'portcath-session-config', key: 'portcathSessionConfig' },
  history: { type: 'portcath-history', key: 'portcathHistory', appendOnly: true },
  admissions: { type: 'admissions', key: 'admissions' },
  followup: { type: 'followup', key: 'followup' },
  tumorboard: { type: 'tumorboard', key: 'tumorboard' },
  clinic: { type: 'clinic', key: 'clinic' },
};

const LOCAL_DB = 'jk.v2.localdb';

export const api = {
  mode: () => (settings.get('localMode') ? 'local' : 'remote'),
  url: () => settings.get('apiUrl') || DEFAULT_API_URL,
  key: () => settings.get('apiKey') || DEFAULT_API_KEY,
  version: 0, // 0 unknown, 1 old script, 2 new script

  // → { tables: { portcath: [...], ... }, settings: {...} }
  async load() {
    if (this.mode() === 'local') return localLoad();
    const json = await getJSON({ action: 'getAll' });
    this.version = Number(json.version) >= 2 ? 2 : 1;
    const tables = {};
    for (const [t, def] of Object.entries(TABLES)) tables[t] = Array.isArray(json[def.key]) ? json[def.key] : [];
    let serverSettings = json.settings || null;
    if (!serverSettings && this.version === 1) {
      try { serverSettings = await getJSON({ action: 'getSettings' }); } catch { serverSettings = null; }
    }
    return { tables, settings: serverSettings || {} };
  },

  // ops: [{ kind: 'upsert'|'delete', table, record?, id? }]
  // known(table, id) tells whether the server already has the row (v1 needs it).
  // Resolves with how many ops (from the start) were applied; throws if none.
  async apply(ops, known) {
    if (this.mode() === 'local') return localApply(ops);
    if (this.version === 0) await this.load().catch(() => {});
    if (this.version >= 2) {
      const res = await post({
        action: 'applyBatch',
        displayName: settings.get('userName') || '',
        ops: ops.map((o) => ({ op: o.kind, type: TABLES[o.table].type, record: o.record, id: o.id })),
      });
      return Number(res.applied ?? ops.length);
    }
    let done = 0;
    for (const o of ops) {
      try {
        await legacyApply(o, known);
      } catch (e) {
        if (done === 0) throw e;
        return done;
      }
      done++;
    }
    return done;
  },

  writeSetting(key, value) {
    if (this.mode() === 'local') return Promise.resolve();
    return post({ action: 'writeSetting', settingKey: key, value });
  },

  async ping() {
    if (this.mode() === 'local') return { version: 'demo' };
    const t0 = performance.now();
    await this.load();
    return { version: this.version, ms: Math.round(performance.now() - t0) };
  },
};

function legacyApply(o, known) {
  const type = TABLES[o.table].type;
  const displayName = settings.get('userName') || '';
  if (o.kind === 'delete') {
    if (!known(o.table, o.id)) return Promise.resolve();   // never reached the sheet
    return post({ action: 'deleteRecord', type, id: o.id, displayName });
  }
  if (known(o.table, o.record.id)) {
    if (TABLES[o.table].appendOnly) return Promise.resolve();
    return post({ action: 'updateRecord', type, record: o.record, displayName });
  }
  return post({ action: 'createRecord', type, record: o.record, displayName });
}

// ---------- HTTP ----------
async function request(url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`The server answered ${res.status}. Try again in a minute.`);
    let json;
    try { json = await res.json(); } catch { throw new Error('The server sent back something unexpected. Check the Apps Script link in Settings.'); }
    if (json.status && json.status !== 'ok') throw new Error(json.message || 'The server refused the change.');
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The server took too long to answer.');
    if (e instanceof TypeError) throw new Error(navigator.onLine ? 'Could not reach the Google Sheet. The change is kept and will be sent again.' : 'You are offline. Changes are kept on this device.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function getJSON(params) {
  const q = new URLSearchParams({ ...params, key: api.key() });
  return request(`${api.url()}?${q}`, { method: 'GET' });
}

// text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
function post(body) {
  return request(api.url(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, key: api.key() }),
  });
}

// ---------- demo database ----------
function readLocal() {
  try {
    const db = JSON.parse(localStorage.getItem(LOCAL_DB) || 'null');
    if (db) return db;
  } catch { /* fall through */ }
  return Object.fromEntries(Object.keys(TABLES).map((t) => [t, {}]));
}
export function writeLocal(db) {
  if (db) localStorage.setItem(LOCAL_DB, JSON.stringify(db)); else localStorage.removeItem(LOCAL_DB);
}

async function localLoad() {
  await new Promise((r) => setTimeout(r, 80));
  const db = readLocal();
  const tables = {};
  for (const t of Object.keys(TABLES)) tables[t] = Object.values(db[t] || {}).filter((r) => !r.deletedAt);
  return { tables, settings: db.__settings || {} };
}

async function localApply(ops) {
  await new Promise((r) => setTimeout(r, 80));
  const db = readLocal();
  for (const o of ops) {
    db[o.table] ||= {};
    if (o.kind === 'delete') { if (db[o.table][o.id]) db[o.table][o.id].deletedAt = new Date().toISOString(); }
    else db[o.table][o.record.id] = { ...(db[o.table][o.record.id] || {}), ...o.record };
  }
  writeLocal(db);
  return ops.length;
}
