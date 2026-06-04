// MedSched Panel — Google Sheets Sync Layer (Phase 2)
// Reads URL/key from window.MEDSCHED_CONFIG (set in index.html inline script)

const GOOGLE_SCRIPT_URL = window.MEDSCHED_CONFIG?.gasUrl || 'PASTE_WEB_APP_URL_HERE';
const SYNC_API_KEY      = window.MEDSCHED_CONFIG?.apiKey || '';
const PENDING_QUEUE_KEY = 'medsched_pending_queue';
const IS_LOCAL_PREVIEW  = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const ENABLE_JSONP_READS = window.MEDSCHED_CONFIG?.jsonpReads === true;

let _pendingQueue = [];
let _isSyncing    = false;
const _syncStateMap = {}; // { [recordId]: 'pending' | 'synced' | 'error' }
let _lastSyncToastStatus = null;

// ── Sync state helpers ───────────────────────────────────────────────────────

function _setSyncState(id, state) {
    if (!id) return;
    _syncStateMap[id] = state;
    const el = document.querySelector(`[data-sync-id="${id}"]`);
    if (!el) return;
    el.className = `sync-row-badge sync-row-${state}`;
    const titles = {
        pending: 'Syncing…',
        synced:  'Synced',
        error:   'Sync failed — will retry'
    };
    el.title = titles[state] || 'Synced';
    el.textContent = state === 'error' ? '⚠' : state === 'pending' ? '⏳' : '✓';
}

// ── Core HTTP ────────────────────────────────────────────────────────────────

async function apiRequest(action, payload) {
    const body = JSON.stringify({ action, key: SYNC_API_KEY, ...normalizeSyncPayload(payload) });
    const resp = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        body: new Blob([body], { type: 'text/plain;charset=utf-8' })
    });
    if (resp.type === 'opaque') return { status: 'ok', opaque: true };
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.status !== 'ok') throw new Error(json.message || 'GAS error');
    return json;
}

// ── Public CRUD wrappers ─────────────────────────────────────────────────────

async function loadFromGoogleSheets() {
    if (IS_LOCAL_PREVIEW && ENABLE_JSONP_READS) return loadFromGoogleSheetsJsonp();

    const url = `${GOOGLE_SCRIPT_URL}?action=getAll&key=${encodeURIComponent(SYNC_API_KEY)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.status !== 'ok') throw new Error(json.message || 'GAS error');
    return json; // { status:'ok', portcath:[], admissions:[], followup:[], tumorboard:[] }
}

function loadFromGoogleSheetsJsonp() {
    return new Promise((resolve, reject) => {
        const callbackName = `medschedJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement('script');
        const cleanup = () => {
            delete window[callbackName];
            script.remove();
        };

        window[callbackName] = (json) => {
            cleanup();
            if (!json || json.status !== 'ok') {
                reject(new Error(json?.message || 'GAS JSONP error'));
                return;
            }
            resolve(json);
        };

        script.onerror = () => {
            cleanup();
            reject(new Error('Failed to load Google Sheets JSONP endpoint'));
        };

        script.src = `${GOOGLE_SCRIPT_URL}?action=getAll&key=${encodeURIComponent(SYNC_API_KEY)}&callback=${encodeURIComponent(callbackName)}`;
        document.head.appendChild(script);
    });
}

async function saveRecordToGoogleSheets(type, record) {
    return apiRequest('createRecord', { type, record: normalizeRecordForSync(record) });
}

async function updateRecordInGoogleSheets(type, record) {
    return apiRequest('updateRecord', { type, record: normalizeRecordForSync(record) });
}

async function deleteRecordFromGoogleSheets(type, id) {
    return apiRequest('deleteRecord', { type, id: normalizeIdForSync(id) });
}

async function _bulkCreateToGoogleSheets(type, records) {
    const operations = records.map(r => ({ op: 'create', record: normalizeRecordForSync(r) }));
    return apiRequest('syncBatch', { type, operations });
}

function normalizeRecordForSync(record) {
    if (!record || typeof record !== 'object') return record;
    return {
        ...record,
        id: normalizeIdForSync(record.id),
        fileNumber: record.fileNumber !== undefined && record.fileNumber !== null ? String(record.fileNumber) : record.fileNumber
    };
}

function normalizeIdForSync(id) {
    if (id === undefined || id === null) return id;
    const textId = String(id);
    return /^\d+$/.test(textId) ? Number(textId) : textId;
}

function normalizeSyncPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    if (payload.record) return { ...payload, record: normalizeRecordForSync(payload.record) };
    if (payload.id !== undefined && payload.id !== null) return { ...payload, id: normalizeIdForSync(payload.id) };
    if (Array.isArray(payload.operations)) {
        return {
            ...payload,
            operations: payload.operations.map(op => ({
                ...op,
                record: normalizeRecordForSync(op.record)
            }))
        };
    }
    return payload;
}

async function _clearTypeInGoogleSheets(type) {
    return apiRequest('clearType', { type });
}

// ── Pending queue ────────────────────────────────────────────────────────────

function _savePendingQueue() {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(_pendingQueue));
}

function _addToPendingQueue(action, type, payload) {
    _pendingQueue.push({
        qid: Date.now().toString(36) + Math.random().toString(36).slice(2),
        action, type, payload, ts: Date.now()
    });
    _savePendingQueue();
    showSyncStatus('pending');
}

async function syncAllLocalPendingChanges() {
    if (_isSyncing || _pendingQueue.length === 0) return;
    _isSyncing = true;
    showSyncStatus('syncing');

    const queue       = [..._pendingQueue];
    const stillFailed = [];

    for (const item of queue) {
        try {
            if      (item.action === 'create')     await saveRecordToGoogleSheets(item.type, item.payload);
            else if (item.action === 'update')     await updateRecordInGoogleSheets(item.type, item.payload);
            else if (item.action === 'delete')     await deleteRecordFromGoogleSheets(item.type, item.payload);
            else if (item.action === 'bulkCreate') await _bulkCreateToGoogleSheets(item.type, item.payload);
            else if (item.action === 'clearType')  await _clearTypeInGoogleSheets(item.type);
        } catch (e) {
            stillFailed.push(item);
        }
    }

    _pendingQueue = stillFailed;
    _savePendingQueue();
    _isSyncing = false;
    showSyncStatus(_pendingQueue.length > 0 ? 'pending' : 'synced');
}

// ── Central sync hook — replaces saveToLocalStorage() at every call site ────

function syncAfterChange(action, type, payload) {
    saveToLocalStorage(); // write cache immediately (synchronous, no UI delay)

    const id = (payload && typeof payload === 'object') ? payload.id : payload;
    if (id && action !== 'bulkCreate') _setSyncState(id, 'pending');

    (async () => {
        showSyncStatus('syncing');
        try {
            if      (action === 'create')     await saveRecordToGoogleSheets(type, payload);
            else if (action === 'update')     await updateRecordInGoogleSheets(type, payload);
            else if (action === 'delete')     await deleteRecordFromGoogleSheets(type, payload);
            else if (action === 'bulkCreate') await _bulkCreateToGoogleSheets(type, payload);
            else if (action === 'clearType')  await _clearTypeInGoogleSheets(type);
            if (id && action !== 'bulkCreate') _setSyncState(id, 'synced');
            showSyncStatus('synced');
        } catch (e) {
            _addToPendingQueue(action, type, payload);
            if (id && action !== 'bulkCreate') _setSyncState(id, 'error');
            console.warn('[Sync] offline — queued:', action, type, e.message);
        }
    })();
}

// ── Sync status indicator ────────────────────────────────────────────────────

function showSyncStatus(status) {
    const el = document.getElementById('sync-status-indicator');
    if (!el) return;
    const map = {
        loading: { text: 'Loading...' },
        syncing: { text: 'Syncing...' },
        synced:  { text: 'Synced' },
        pending: { text: `Pending (${_pendingQueue.length})` },
        offline: { text: 'Offline' }
    };
    const s = map[status] || map.offline;
    el.textContent = s.text;
    el.dataset.status = status;

    if (typeof showToast === 'function' && _lastSyncToastStatus !== status) {
        if (status === 'syncing') showToast('Syncing changes with Google Sheets...', 'info', 2200);
        if (status === 'synced') showToast('Google Sheets is up to date.', 'success', 2400);
        if (status === 'pending') showToast(`${_pendingQueue.length} change(s) queued for retry.`, 'warning', 3600);
        _lastSyncToastStatus = status;
    }

    if (status === 'synced') setTimeout(() => showSyncStatus('offline'), 3000);
}

// ── Boot initializer — called once from DOMContentLoaded in app.js ───────────

async function initGoogleSheetsSync() {
    const stored = localStorage.getItem(PENDING_QUEUE_KEY);
    _pendingQueue = stored ? JSON.parse(stored) : [];

    if (IS_LOCAL_PREVIEW && !ENABLE_JSONP_READS) {
        showSyncStatus(_pendingQueue.length > 0 ? 'pending' : 'offline');
        await syncAllLocalPendingChanges();
        return;
    }

    showSyncStatus('loading');
    try {
        const data = await loadFromGoogleSheets();
        if (Array.isArray(data.portcath))   portCathList   = data.portcath;
        if (Array.isArray(data.admissions)) admissionsList = data.admissions;
        if (Array.isArray(data.followup))   followUpList   = data.followup;
        if (Array.isArray(data.tumorboard)) tumorBoardList = data.tumorboard;
        if (typeof sanitizeAllPatientLists === 'function') sanitizeAllPatientLists();
        saveToLocalStorage(); // update cache with fresh GAS data
        updateDateDropdown('portcath');
        updateDateDropdown('admissions');
        updateDateDropdown('followup');
        renderPortCathTable();
        renderAdmissionsTable();
        renderFollowUpTable();
        renderTumorBoardTable();
        renderDashboard();
        showSyncStatus('synced');
        await syncAllLocalPendingChanges();
    } catch (e) {
        console.warn('[Sync] GAS load failed, using cache:', e.message);
        showSyncStatus('offline');
    }
}
