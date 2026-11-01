// Domain rules: what a status means, which day is a session day, what needs
// attention. Views read through these helpers instead of poking at raw rows.
import { store, upsert, create, all } from './store.js';
import { todayISO, dayName, byText, uniq, matches, normFile, monthKey } from './util.js';
import { settings } from './settings.js';

// ---------- memoised lists ----------
let memo = { v: -1 };
export function lists() {
  if (memo.v === store.version) return memo;
  const today = todayISO();
  const pc = all('portcath');
  const sessionsByDate = new Map();
  for (const s of all('sessions')) {
    if (!s.date) continue;
    const cur = sessionsByDate.get(s.date);
    if (!cur || String(s.updatedAt || s.createdAt || '') > String(cur.updatedAt || cur.createdAt || '')) sessionsByDate.set(s.date, s);
  }
  const pcByDate = new Map();
  for (const p of pc) {
    if (!p.date || p.status === 'waiting') continue;
    if (!pcByDate.has(p.date)) pcByDate.set(p.date, []);
    pcByDate.get(p.date).push(p);
  }
  memo = {
    v: store.version,
    today,
    portcath: pc,
    waiting: pc.filter((p) => p.status === 'waiting' || (!p.date && p.status !== 'cancelled' && p.status !== 'done')).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    awaiting: pc.filter((p) => isBooked(p) && p.date < today).sort((a, b) => a.date.localeCompare(b.date) || byText(a.name, b.name)),
    pcByDate,
    sessionsByDate,
    admissions: all('admissions'),
    followup: all('followup'),
    tumorboard: all('tumorboard'),
    clinic: all('clinic'),
    history: all('history').sort((a, b) => b.timestamp - a.timestamp),
  };
  return memo;
}

// ---------- port cath ----------
export const PC_STATUS = {
  waiting: { label: 'Waiting list', tone: 'amber' },
  confirmed: { label: 'Booked', tone: 'blue' },
  scheduled: { label: 'Booked', tone: 'blue' },
  done: { label: 'Port done', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
};
export const pcStatus = (p) => PC_STATUS[p.status] || { label: p.status || 'Booked', tone: 'blue' };
export const isBooked = (p) => (p.status === 'confirmed' || p.status === 'scheduled' || !PC_STATUS[p.status]) && !!p.date && p.status !== 'waiting';
export const needsOutcome = (p) => isBooked(p) && p.date < todayISO();

// A day is a session day if it was switched on in "Session days", or if
// patients are booked on it (older data has bookings without a config row).
export function isSessionDay(date) {
  const L = lists();
  const s = L.sessionsByDate.get(date);
  if (s) return s.isActive;
  return (L.pcByDate.get(date) || []).some((p) => p.status !== 'cancelled');
}
export function sessionDaysInMonth(key) {
  const L = lists();
  const days = new Set();
  for (const [d, s] of L.sessionsByDate) if (s.isActive && monthKey(d) === key) days.add(d);
  for (const d of L.pcByDate.keys()) if (monthKey(d) === key && isSessionDay(d)) days.add(d);
  return [...days].sort();
}
export function upcomingSessions(from = todayISO(), n = 8) {
  const L = lists();
  const days = new Set();
  for (const [d, s] of L.sessionsByDate) if (s.isActive && d >= from) days.add(d);
  for (const d of L.pcByDate.keys()) if (d >= from && isSessionDay(d)) days.add(d);
  return [...days].sort().slice(0, n);
}
export const patientsOn = (date) => (lists().pcByDate.get(date) || []).slice().sort((a, b) => order(a) - order(b) || byText(a.name, b.name));
const order = (p) => ({ done: 2, cancelled: 3 }[p.status] ?? 1);

export function setSessionDay(date, active) {
  const existing = lists().sessionsByDate.get(date);
  const d = new Date(date + 'T00:00:00');
  if (existing) upsert('sessions', { id: existing.id, isActive: active });
  else create('sessions', { date, year: d.getFullYear(), month: d.getMonth(), dayOfWeek: dayName(date), isActive: active, syncStatus: '' });
}

function log(p, action, extra = {}) {
  create('history', {
    patientId: p.id, patientName: p.name, fileNumber: p.fileNumber, action,
    fromDate: extra.fromDate ?? p.date ?? '', toDate: extra.toDate ?? '', reason: extra.reason || '', note: extra.note || '',
    timestamp: Date.now(), syncStatus: '',
  });
}

export const pc = {
  done(p, note = '') {
    upsert('portcath', { id: p.id, status: 'done', doneAt: p.date || todayISO(), outcomeNote: note });
    log(p, 'done', { note });
  },
  undoDone(p) {
    upsert('portcath', { id: p.id, status: 'confirmed', doneAt: '', outcomeNote: '' });
    log(p, 'restore', { reason: 'Port-done mark removed' });
  },
  // Carry the patient over (ترحيل) to another day.
  move(p, toDate, reason) {
    const fromDate = p.date;
    upsert('portcath', { id: p.id, date: toDate, day: dayName(toDate), status: 'confirmed', doneAt: '' });
    log(p, 'move', { fromDate, toDate, reason });
  },
  toWaiting(p, reason) {
    const fromDate = p.date;
    upsert('portcath', { id: p.id, date: '', day: '', status: 'waiting', doneAt: '' });
    log(p, 'move', { fromDate, toDate: '', reason: reason || 'Moved to waiting list' });
  },
  cancel(p, reason) {
    upsert('portcath', { id: p.id, status: 'cancelled' });
    log(p, 'cancel', { reason });
  },
  restore(p, reason) {
    upsert('portcath', { id: p.id, status: p.date ? 'confirmed' : 'waiting' });
    log(p, 'restore', { reason });
  },
  add(fields) {
    const row = create('portcath', { ...fields, day: dayName(fields.date), status: fields.date ? 'confirmed' : 'waiting' });
    log(row, 'add', { fromDate: '', toDate: row.date, reason: row.date ? 'Booked' : 'Added to waiting list' });
    return row;
  },
};

export const historyOf = (id) => lists().history.filter((h) => h.patientId === id);

export const HISTORY_LABEL = { move: 'Moved', cancel: 'Cancelled', restore: 'Restored', noshow: 'No-show', apologize: 'Apologised', done: 'Port done', add: 'Added', edit: 'Edited', notdone: 'Not done' };

// Port cath records of the same person (by file number).
export function samePatient(fileNumber, exceptId) {
  const k = normFile(fileNumber);
  if (!k) return [];
  return lists().portcath.filter((p) => p.id !== exceptId && normFile(p.fileNumber) === k);
}

// ---------- admissions ----------
export const TRIAGE = {
  1: { label: 'Resuscitation', tone: 'red' },
  2: { label: 'Emergent', tone: 'orange' },
  3: { label: 'Urgent', tone: 'amber' },
  4: { label: 'Less urgent', tone: 'green' },
  5: { label: 'Non-urgent', tone: 'blue' },
};
export const DEPARTMENTS = ['Treatment room', 'Day care', 'Hospital Admission'];
export const REFERRALS = ['Home', 'Hospital'];
export const TRANSPORT = ['Private Car', 'Taxi', 'Hospital Bus', 'Ambulance'];
export const PERFORMANCE = ['Walking', 'Wheelchair', 'Bedridden'];

// ---------- tumor board ----------
export const TASK_TYPES = {
  referral_followup: { ar: 'متابعة تحويلة', en: 'Referral follow-up' },
  referral_submit: { ar: 'تقديم تحويلة', en: 'Submit referral' },
  permit_submit: { ar: 'تقديم تصريح', en: 'Submit permit' },
  clinic_booking: { ar: 'حجز عيادة', en: 'Clinic booking' },
  imaging_request: { ar: 'طلب صور طبية', en: 'Imaging request' },
  lab_request: { ar: 'طلب فحوصات طبية', en: 'Lab request' },
  other: { ar: 'متابعة أخرى', en: 'Other' },
};
export const openTasks = (p) => (p.tasks || []).filter((t) => t.status !== 'completed');

// ---------- follow-up ----------
export const fuDone = (f) => !!String(f.taskResult || '').trim();

// ---------- clinic ----------
const PALETTE = ['#0F766E', '#2563EB', '#7C3AED', '#DC2626', '#EA580C', '#16A34A', '#0891B2', '#BE123C', '#9333EA', '#4F46E5', '#CA8A04', '#059669'];
const hash = (s) => [...String(s)].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
export const doctorName = (v) => String(v || '').trim() || 'Unassigned';
export function doctorColor(name) {
  const key = doctorName(name);
  const custom = { ...(parseColors(store.serverSettings?.clinicPhysicianColors)), ...settings.get('physicianColors') };
  return custom[key] || PALETTE[Math.abs(hash(key)) % PALETTE.length];
}
function parseColors(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return {}; }
}
export const clinicDoctors = () => uniq(lists().clinic.map((c) => doctorName(c.primaryPhysician))).sort(byText);

// ---------- physicians across modules (for autocomplete) ----------
export function knownPhysicians() {
  const L = lists();
  return uniq([...L.admissions.map((a) => a.primaryPhysician), ...L.clinic.map((c) => c.primaryPhysician), ...L.tumorboard.map((t) => t.physician)]
    .map((s) => String(s || '').trim()).filter((s) => s && s !== 'Unassigned')).sort(byText);
}

// ---------- global search ----------
const MODULES = [
  { table: 'portcath', label: 'Port cath', route: 'portcath' },
  { table: 'admissions', label: 'Admissions', route: 'admissions' },
  { table: 'followup', label: 'Follow-up', route: 'followup' },
  { table: 'tumorboard', label: 'Tumor board', route: 'tumorboard' },
  { table: 'clinic', label: 'Clinic', route: 'clinic' },
];
export function search(q, limit = 12) {
  const term = String(q || '').trim();
  if (term.length < 2) return [];
  const nf = normFile(term);
  const L = lists();
  const out = [];
  for (const m of MODULES) {
    for (const r of L[m.table]) {
      const hit = (nf.length >= 3 && normFile(r.fileNumber).includes(nf)) || matches(term, r.name, r.phone, r.primaryPhysician, r.physician, r.task, r.diagnosis);
      if (hit) out.push({ ...m, row: r });
    }
  }
  return out.sort((a, b) => String(b.row.date || '').localeCompare(String(a.row.date || ''))).slice(0, limit);
}
