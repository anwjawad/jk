// Port Cath: session calendar, day list, waiting list, outcomes and register.
// After the appointment day, every booked patient must be confirmed as
// "Port done" or "Not done" (then carried over, sent back to the waiting list, or cancelled).
import { html, esc, $, $$, todayISO, addDays, fmtDate, fmtMonth, monthKey, addMonths, parseISO, toISO, dayName, relDay, matches, byText, fmtTime, plural, cleanText, downloadFile } from '../util.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { get, remove, restore, upsert, batch } from '../store.js';
import { lists, pc, pcStatus, isBooked, patientsOn, isSessionDay, sessionDaysInMonth, upcomingSessions, setSessionDay, historyOf, HISTORY_LABEL, samePatient } from '../model.js';
import { icon, modal, confirmBox, toast, menu, chip, empty, telLinks } from '../ui.js';
import { printDialog } from '../print.js';

export const title = () => 'Port Cath';
export const sub = () => {
  const L = lists();
  return `${plural(L.waiting.length, 'patient')} waiting · ${L.awaiting.length ? `${L.awaiting.length} awaiting outcome` : 'all outcomes recorded'}`;
};

let focusId = '';
export function onRoute(params) {
  if (!ui.pcMonth) ui.pcMonth = monthKey(todayISO());
  if (!ui.pcDay) ui.pcDay = upcomingSessions(todayISO(), 1)[0] || todayISO();
  if (params.get('tab')) ui.pcTab = params.get('tab');
  if (params.get('day')) { ui.pcDay = params.get('day'); ui.pcMonth = monthKey(ui.pcDay); ui.pcTab = 'schedule'; }
  const id = params.get('focus');
  if (id) {
    const p = get('portcath', id);
    if (p) {
      focusId = id;
      if (lists().waiting.includes(p)) ui.pcTab = 'waiting';
      else if (p.date) { ui.pcTab = 'schedule'; ui.pcDay = p.date; ui.pcMonth = monthKey(p.date); }
    }
  }
}

export function mount(root) {
  if (!focusId) return;
  const row = root.querySelector(`[data-row="${CSS.escape(focusId)}"]`);
  focusId = '';
  if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('flash'); }
}

// ---------- render ----------
export function render() {
  const L = lists();
  const tabs = [
    ['schedule', 'Schedule', ''],
    ['awaiting', 'Awaiting outcome', L.awaiting.length, 'warn'],
    ['waiting', 'Waiting list', L.waiting.length],
    ['register', 'Register', ''],
  ];
  const body = { schedule: renderSchedule, awaiting: renderAwaiting, waiting: renderWaiting, register: renderRegister }[ui.pcTab] || renderSchedule;
  return html`
    ${kpis()}
    <div class="toolbar">
      <div class="tabs" role="tablist" aria-label="Port cath views">
        ${tabs.map(([k, label, n, tone]) => html`<button type="button" class="tab ${ui.pcTab === k ? 'active' : ''}" role="tab" aria-selected="${String(ui.pcTab === k)}" data-action="pc-tab" data-tab="${k}">${label}${n !== '' && n !== undefined ? html`<span class="n ${n && tone ? tone : ''}">${n}</span>` : ''}</button>`)}
      </div>
      <span class="spacer"></span>
      <button type="button" class="btn" data-action="pc-sessions">${icon('calCheck', 17)} Session days</button>
      <button type="button" class="btn" data-action="pc-print">${icon('print', 17)} Print / Export</button>
      <button type="button" class="btn btn-primary" data-action="pc-add">${icon('plus', 17)} Add patient</button>
    </div>
    ${body()}`;
}

function kpis() {
  const L = lists();
  const key = ui.pcMonth;
  const inMonth = L.portcath.filter((p) => p.date && monthKey(p.date) === key);
  const booked = inMonth.filter(isBooked).length;
  const cancelled = inMonth.filter((p) => p.status === 'cancelled').length;
  // Completion over the last 30 days, so it means something on the 1st of a month too.
  const from = addDays(L.today, -30);
  const recent = L.portcath.filter((p) => p.date && p.date >= from && p.date <= L.today);
  const done = recent.filter((p) => p.status === 'done').length;
  const pastOpen = recent.filter((p) => isBooked(p) && p.date < L.today).length;
  const rate = done + pastOpen ? Math.round((done / (done + pastOpen)) * 100) : null;
  const days = sessionDaysInMonth(key).length;
  return html`
    <div class="kpis">
      <div class="kpi"><span class="k-label">${icon('calendar', 15)} Session days · ${fmtMonth(key)}</span><b>${days}</b><small>${plural(inMonth.length - cancelled, 'patient')} scheduled</small></div>
      <div class="kpi"><span class="k-label">${icon('clock', 15)} Booked, not yet done</span><b>${booked}</b><small>this month</small></div>
      <div class="kpi good"><span class="k-label">${icon('checkCircle', 15)} Port done · last 30 days</span><b>${done}</b>
        <small>${rate === null ? 'no sessions in the last 30 days' : `${rate}% of bookings confirmed done`}</small>
        ${rate !== null ? html`<div class="meter" aria-hidden="true"><span style="width:${rate}%;background:var(--green)"></span></div>` : ''}</div>
      <button type="button" class="kpi ${L.awaiting.length ? 'alert' : ''}" data-action="pc-tab" data-tab="awaiting"><span class="k-label">${icon('alert', 15)} Awaiting outcome</span><b>${L.awaiting.length}</b><small>${L.awaiting.length ? 'confirm port done or not' : 'nothing pending'}</small></button>
      <button type="button" class="kpi" data-action="pc-tab" data-tab="waiting"><span class="k-label">${icon('users', 15)} Waiting list</span><b>${L.waiting.length}</b><small>${L.waiting.length ? `oldest ${relDay(String(L.waiting[0].createdAt || '').slice(0, 10)) || 'unknown'}` : 'empty'}</small></button>
    </div>`;
}

// ----- schedule: calendar + day -----
function renderSchedule() {
  return html`
    <div class="split">
      <section class="panel sticky" aria-label="Month calendar">${monthCalendar(ui.pcMonth, ui.pcDay)}</section>
      <section class="panel" aria-label="Selected day">${dayPanel(ui.pcDay)}</section>
    </div>`;
}

function monthCalendar(key, selected) {
  const L = lists();
  const first = parseISO(key + '-01');
  const lead = first.getDay();
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(html`<span class="day out" aria-hidden="true"></span>`);
  for (let d = 1; d <= daysIn; d++) {
    const date = `${key}-${String(d).padStart(2, '0')}`;
    const pts = (L.pcByDate.get(date) || []).filter((p) => p.status !== 'cancelled');
    const cfg = L.sessionsByDate.get(date);
    const session = isSessionDay(date);
    const off = cfg && !cfg.isActive;
    const open = pts.some((p) => isBooked(p) && date < L.today);
    const done = pts.filter((p) => p.status === 'done').length;
    const cls = [date === L.today && 'today', date < L.today && 'past', session && 'session', off && 'off', date === selected && 'selected'].filter(Boolean).join(' ');
    const label = `${fmtDate(date, 'long')}${session ? ', session day' : ''}${off ? ', session cancelled' : ''}, ${plural(pts.length, 'patient')}${open ? ', outcome missing' : ''}`;
    cells.push(html`<button type="button" class="day ${cls}" data-action="pc-day" data-date="${date}" aria-label="${label}" aria-pressed="${String(date === selected)}">
      <span class="dn">${d}</span>
      ${pts.length ? html`<span class="cnt">${pts.length}</span>` : ''}
      ${done ? html`<span class="dots"><i style="background:var(--green)"></i></span>` : ''}
      ${open ? html`<span class="flag" title="Outcome missing"></span>` : ''}
    </button>`);
  }
  return html`
    <div class="cal-head">
      <button type="button" class="icon-btn" data-action="pc-month" data-to="${addMonths(key, -1)}" aria-label="Previous month">${icon('chevL')}</button>
      <h3>${fmtMonth(key)}</h3>
      <button type="button" class="icon-btn" data-action="pc-month" data-to="${addMonths(key, 1)}" aria-label="Next month">${icon('chevR')}</button>
    </div>
    <div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => html`<span class="dow">${d}</span>`)}${cells}</div>
    <div class="cal-legend">
      <span><i style="background:var(--brand-soft);border:1px solid var(--brand)"></i>Session day</span>
      <span><i style="background:var(--green)"></i>Has port done</span>
      <span><i style="background:var(--orange);border-radius:50%"></i>Outcome missing</span>
    </div>`;
}

function dayPanel(date) {
  const L = lists();
  const pts = patientsOn(date);
  const active = pts.filter((p) => p.status !== 'cancelled');
  const done = pts.filter((p) => p.status === 'done').length;
  const open = pts.filter(isBooked);
  const session = isSessionDay(date);
  const cfg = L.sessionsByDate.get(date);
  const canConfirm = date <= L.today && open.length > 0;
  return html`
    <div class="panel-head">
      <div>
        <h2>${fmtDate(date, 'long')} <span class="muted small">${relDay(date)}</span></h2>
        <div class="row" style="margin-top:6px">
          ${session ? chip('Session day', 'brand') : cfg && !cfg.isActive ? chip('Session cancelled', 'red') : chip('Not a session day', 'outline')}
          ${chip(`${active.length} scheduled`, 'blue')}
          ${done ? chip(`${done} port done`, 'green') : ''}
          ${open.length && date < L.today ? chip(`${open.length} awaiting outcome`, 'orange') : ''}
        </div>
      </div>
      <div class="row">
        ${canConfirm && open.length > 1 ? html`<button type="button" class="btn btn-sm btn-done" data-action="pc-all-done" data-date="${date}">${icon('check', 15)} All ${open.length} done</button>` : ''}
        <button type="button" class="btn btn-sm" data-action="pc-print-day" data-date="${date}">${icon('print', 15)} Print</button>
        <button type="button" class="btn btn-sm btn-primary" data-action="pc-add" data-date="${date}">${icon('plus', 15)} Add</button>
        ${menu(html`
          <button type="button" data-action="pc-toggle-session" data-date="${date}">${icon('calCheck', 16)} ${session ? 'Cancel this session day' : 'Make this a session day'}</button>
          <button type="button" data-action="pc-word-day" data-date="${date}">${icon('word', 16)} Export day to Word</button>`)}
      </div>
    </div>
    ${pts.length
      ? html`<ul class="pt-list">${pts.map((p) => ptRow(p))}</ul>`
      : empty('No patients on this day', session ? 'Add a patient or assign someone from the waiting list.' : 'Pick a highlighted session day on the calendar, or add a patient here.', html`<button type="button" class="btn btn-sm" data-action="pc-tab" data-tab="waiting">Open waiting list</button>`)}
    ${historyFor(date)}`;
}

function historyFor(date) {
  const items = lists().history.filter((h) => h.fromDate === date || h.toDate === date).slice(0, 10);
  if (!items.length) return '';
  return html`
    <details class="panel-foot" style="display:block">
      <summary class="small muted" style="cursor:pointer;font-weight:650">Activity on this day (${items.length})</summary>
      <ul class="timeline" style="margin-top:8px">${items.map(historyItem)}</ul>
    </details>`;
}

function historyItem(h) {
  const label = HISTORY_LABEL[h.action] || h.action;
  const where = h.action === 'move' ? (h.toDate ? `${h.fromDate ? fmtDate(h.fromDate) + ' → ' : ''}${fmtDate(h.toDate)}` : 'to waiting list') : '';
  return html`<li><span class="when">${fmtTime(h.timestamp)}</span><span><b>${label}</b> · ${h.patientName}${where ? html` · ${where}` : ''}${h.reason ? html` <span class="muted">— ${h.reason}</span>` : ''}</span></li>`;
}

const initials = (name) => cleanText(name).split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

// One patient row; `ctx` adds the date when the list spans many days.
function ptRow(p, { showDate = false } = {}) {
  const L = lists();
  const st = pcStatus(p);
  const past = p.date && p.date <= L.today;
  const actions = [];
  if (isBooked(p) && past) {
    actions.push(html`<button type="button" class="btn btn-sm btn-done" data-action="pc-done" data-id="${p.id}">${icon('check', 15)} Port done</button>`);
    actions.push(html`<button type="button" class="btn btn-sm btn-notdone" data-action="pc-notdone" data-id="${p.id}">${icon('x', 15)} Not done</button>`);
  } else if (p.status === 'waiting' || !p.date) {
    actions.push(html`<button type="button" class="btn btn-sm btn-primary" data-action="pc-assign" data-id="${p.id}">${icon('calendar', 15)} Assign date</button>`);
  } else if (p.status === 'done') {
    actions.push(html`<span class="outcome ok">${icon('checkCircle', 16)} Port done${p.doneAt && p.doneAt !== p.date ? ` · ${fmtDate(p.doneAt)}` : ''}</span>`);
  } else if (p.status === 'cancelled') {
    actions.push(chip('Cancelled', ''));
  } else if (isBooked(p)) {
    actions.push(html`<button type="button" class="btn btn-sm btn-ghost" data-action="pc-move" data-id="${p.id}">${icon('forward', 15)} Move</button>`);
  }
  const more = [];
  more.push(html`<button type="button" data-action="pc-edit" data-id="${p.id}">${icon('edit', 16)} Edit details</button>`);
  if (isBooked(p)) {
    more.push(html`<button type="button" data-action="pc-move" data-id="${p.id}">${icon('forward', 16)} Move to another day</button>`);
    more.push(html`<button type="button" data-action="pc-to-waiting" data-id="${p.id}">${icon('users', 16)} Back to waiting list</button>`);
    if (!past) more.push(html`<button type="button" data-action="pc-done" data-id="${p.id}">${icon('check', 16)} Mark port done</button>`);
  }
  if (p.status === 'done') more.push(html`<button type="button" data-action="pc-undo-done" data-id="${p.id}">${icon('undo', 16)} Remove “port done”</button>`);
  if (p.status !== 'cancelled' && p.status !== 'done') more.push(html`<button type="button" data-action="pc-cancel" data-id="${p.id}">${icon('xCircle', 16)} Cancel</button>`);
  if (p.status === 'cancelled') more.push(html`<button type="button" data-action="pc-restore" data-id="${p.id}">${icon('undo', 16)} Restore</button>`);
  more.push(html`<button type="button" data-action="pc-history" data-id="${p.id}">${icon('history', 16)} History</button>`);
  more.push(html`<hr><button type="button" class="danger" data-action="pc-delete" data-id="${p.id}">${icon('trash', 16)} Delete record</button>`);
  return html`
    <li class="pt" data-row="${p.id}" data-status="${p.status === 'scheduled' ? 'confirmed' : p.status}">
      <span class="av" aria-hidden="true">${p.status === 'done' ? icon('check', 17) : initials(p.name)}</span>
      <div style="min-width:0">
        <div class="nm"><button type="button" data-action="pc-edit" data-id="${p.id}">${p.name || 'Unnamed'}</button>${st.tone !== 'blue' || showDate ? chip(st.label, st.tone) : ''}${showDate && p.date ? html`<span class="muted small">${fmtDate(p.date, 'med')}</span>` : ''}</div>
        <div class="facts">
          <span>File <b class="ltr">${p.fileNumber || '—'}</b></span>
          ${p.weight ? html`<span><b>${p.weight}</b> kg</span>` : html`<span class="warn-text">No weight</span>`}
          ${p.phone ? telLinks(p.phone) : ''}
          ${p.nextChemoAppt ? html`<span>Next chemo <b>${fmtDate(p.nextChemoAppt, 'med')}</b></span>` : ''}
        </div>
        ${p.notes ? html`<div class="note rtl-text">${p.notes}</div>` : ''}
        ${p.outcomeNote ? html`<div class="note">${p.outcomeNote}</div>` : ''}
      </div>
      <div class="acts">${actions}${menu(more)}</div>
    </li>`;
}

// ----- awaiting outcome -----
function renderAwaiting() {
  const L = lists();
  if (!L.awaiting.length) return html`<section class="panel">${empty('Every past booking has an outcome', 'After each session, patients appear here until you mark them “Port done” or “Not done”.')}</section>`;
  const byDate = new Map();
  for (const p of L.awaiting) { if (!byDate.has(p.date)) byDate.set(p.date, []); byDate.get(p.date).push(p); }
  return html`
    <section class="panel">
      <div class="panel-head"><div><h2>${icon('alert', 18)} Awaiting outcome</h2><p>Not every booked patient ends up getting the port. Confirm each one so the lists and statistics stay true.</p></div></div>
      ${[...byDate].map(([date, pts]) => html`
        <div class="group-h"><span>${fmtDate(date, 'long')} · ${relDay(date)} · ${plural(pts.length, 'patient')}</span>
          ${pts.length > 1 ? html`<button type="button" class="btn btn-sm btn-done" data-action="pc-all-done" data-date="${date}">${icon('check', 15)} All done</button>` : ''}</div>
        <ul class="pt-list">${pts.map((p) => ptRow(p))}</ul>`)}
    </section>`;
}

// ----- waiting list -----
function renderWaiting() {
  const L = lists();
  const q = ui.pcQuery;
  const rows = L.waiting.filter((p) => matches(q, p.name, p.fileNumber, p.phone, p.notes));
  const next = upcomingSessions(todayISO(), 1)[0];
  return html`
    <section class="panel">
      <div class="panel-head">
        <div><h2>${icon('users', 18)} Waiting list</h2><p>Patients who need a port but have no date yet, oldest first.${next ? ` Next session: ${fmtDate(next, 'med')}.` : ''}</p></div>
        <div class="row">
          <label class="search-box"><span class="sr-only">Search waiting list</span>${icon('search', 16)}<input class="input" type="search" value="${q}" data-input="pc-query" data-key="pc-q" placeholder="Search…" autocomplete="off"></label>
          <button type="button" class="btn btn-sm" data-action="pc-print-waiting">${icon('print', 15)} Print</button>
          <button type="button" class="btn btn-sm btn-primary" data-action="pc-add" data-date="waiting">${icon('plus', 15)} Add to waiting list</button>
        </div>
      </div>
      ${rows.length ? html`<ul class="pt-list">${rows.map((p) => ptRow(p))}</ul>` : empty(q ? 'No match' : 'Nobody is waiting', q ? 'Try another name or file number.' : 'Patients you add without a date appear here.')}
    </section>`;
}

// ----- register -----
const REG_FILTERS = [['all', 'All'], ['booked', 'Booked'], ['done', 'Port done'], ['waiting', 'Waiting'], ['cancelled', 'Cancelled']];
function regRows() {
  const L = lists();
  const f = ui.pcStatus;
  return L.portcath
    .filter((p) => f === 'all' || (f === 'booked' ? isBooked(p) : f === 'waiting' ? L.waiting.includes(p) : p.status === f))
    .filter((p) => matches(ui.pcQuery, p.name, p.fileNumber, p.phone, p.notes))
    .sort((a, b) => String(b.date || '9999').localeCompare(String(a.date || '9999')) || byText(a.name, b.name));
}
function renderRegister() {
  const rows = regRows();
  const shown = rows.slice(0, 300);
  return html`
    <section class="panel">
      <div class="panel-head">
        <div class="pills" role="group" aria-label="Filter by status">${REG_FILTERS.map(([k, l]) => html`<button type="button" class="pill ${ui.pcStatus === k ? 'active' : ''}" aria-pressed="${String(ui.pcStatus === k)}" data-action="pc-filter" data-f="${k}">${l}</button>`)}</div>
        <div class="row">
          <label class="search-box"><span class="sr-only">Search register</span>${icon('search', 16)}<input class="input" type="search" value="${ui.pcQuery}" data-input="pc-query" data-key="pc-q2" placeholder="Name, file, phone…" autocomplete="off"></label>
          <button type="button" class="btn btn-sm" data-action="pc-csv">${icon('download', 15)} CSV</button>
        </div>
      </div>
      ${rows.length ? html`
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Patient</th><th>Status</th><th>Date</th><th>Weight</th><th>Phone</th><th>Next chemo</th><th>Notes</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${shown.map((p) => { const st = pcStatus(p); return html`<tr data-row="${p.id}">
            <td><button type="button" class="name-btn" data-action="pc-edit" data-id="${p.id}">${p.name}</button><div class="file">${p.fileNumber}</div></td>
            <td>${chip(st.label, st.tone)}</td>
            <td class="nowrap">${p.date ? fmtDate(p.date, 'med') : '—'}</td>
            <td>${p.weight || '—'}</td>
            <td class="nowrap">${p.phone ? telLinks(p.phone) : '—'}</td>
            <td class="nowrap">${p.nextChemoAppt ? fmtDate(p.nextChemoAppt) : '—'}</td>
            <td class="rtl-text" style="max-width:260px">${p.notes}</td>
            <td><button type="button" class="icon-btn sm" data-action="pc-history" data-id="${p.id}" aria-label="History of ${p.name}">${icon('history', 16)}</button></td>
          </tr>`; })}</tbody>
        </table></div>
        ${rows.length > shown.length ? html`<div class="panel-foot muted small">Showing 300 of ${rows.length}. Narrow the search to see the rest.</div>` : ''}`
      : empty('No records match', 'Change the filter or the search.')}
    </section>`;
}

// ---------- dialogs ----------
// Upcoming session days as one-click chips, plus a free date. Optional "Waiting list".
function dateChooser({ value = '', allowWaiting = false, from = todayISO(), exclude = '' } = {}) {
  const days = upcomingSessions(from, 10).filter((d) => d !== exclude);
  const isCustom = value && value !== 'waiting' && !days.includes(value);
  return html`
    <div class="field" data-date-chooser>
      <span>Date <span class="req">*</span></span>
      <input type="hidden" name="date" value="${value}">
      <div class="date-chips" role="group" aria-label="Upcoming session days">
        ${allowWaiting ? html`<button type="button" class="date-chip ${value === 'waiting' ? 'on' : ''}" data-pick="waiting"><b>Waiting list</b><small>no date yet</small></button>` : ''}
        ${days.map((d) => { const n = patientsOn(d).filter((p) => p.status !== 'cancelled').length; return html`<button type="button" class="date-chip ${value === d ? 'on' : ''}" data-pick="${d}"><b>${fmtDate(d, 'med')}</b><small>${relDay(d)} · ${n} booked</small></button>`; })}
      </div>
      ${days.length ? '' : html`<small class="hint">No upcoming session days are set. Pick a date below, or set them in “Session days”.</small>`}
      <label class="row small" style="margin-top:6px"><span class="muted">Other date</span><input type="date" class="input" style="max-width:190px" data-custom value="${isCustom ? value : ''}"></label>
    </div>`;
}
function mountDateChooser(root) {
  const box = $('[data-date-chooser]', root);
  if (!box) return;
  const hidden = $('input[name=date]', box);
  const custom = $('[data-custom]', box);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    hidden.value = b.dataset.pick;
    custom.value = '';
    $$('.date-chip', box).forEach((c) => c.classList.toggle('on', c === b));
  });
  custom.addEventListener('change', () => {
    hidden.value = custom.value;
    $$('.date-chip', box).forEach((c) => c.classList.remove('on'));
  });
}

async function editPatient(p, preset = '') {
  const isNew = !p;
  p ||= {};
  const value = isNew ? (preset || '') : (p.status === 'waiting' || !p.date ? 'waiting' : p.date);
  const r = await modal({
    title: isNew ? 'Add port cath patient' : 'Edit patient',
    subtitle: isNew ? 'Book a session day, or put the patient on the waiting list.' : `${pcStatus(p).label}${p.date ? ' · ' + fmtDate(p.date, 'long') : ''}`,
    size: 'l',
    body: html`
      <div class="grid-2">
        <label class="field span-2"><span>Patient name <span class="req">*</span></span><input name="name" value="${p.name || ''}" autocomplete="off" required></label>
        <label class="field"><span>File number <span class="req">*</span></span><input name="fileNumber" class="ltr" value="${p.fileNumber || ''}" autocomplete="off" inputmode="numeric" spellcheck="false"></label>
        <label class="field"><span>Weight (kg) <span class="req">*</span></span><input name="weight" type="number" step="0.1" min="1" max="300" value="${p.weight || ''}" inputmode="decimal"></label>
        <label class="field"><span>Phone</span><input name="phone" type="tel" class="ltr" value="${p.phone || ''}" autocomplete="off" placeholder="059…"></label>
        <label class="field"><span>Next chemo appointment</span><input name="nextChemoAppt" type="date" value="${p.nextChemoAppt || ''}"></label>
        <div class="span-2" data-dup></div>
        ${isNew || isBooked(p) || p.status === 'waiting' ? html`<div class="span-2">${dateChooser({ value, allowWaiting: true })}</div>` : ''}
        <label class="field span-2"><span>Notes</span><textarea name="notes" rows="2">${p.notes || ''}</textarea></label>
      </div>`,
    primary: isNew ? 'Add patient' : 'Save changes',
    onMount: (dlg) => {
      mountDateChooser(dlg);
      const file = dlg.querySelector('[name=fileNumber]');
      const dup = dlg.querySelector('[data-dup]');
      const check = () => {
        const others = samePatient(file.value, p.id).filter((o) => o.status !== 'cancelled');
        dup.innerHTML = others.length ? `<p class="warn-text">${icon('alert', 15)} Already on the list: ${others.map((o) => `${esc(o.name)} — ${o.status === 'done' ? 'port done ' + esc(fmtDate(o.doneAt || o.date)) : o.date ? esc(fmtDate(o.date, 'med')) : 'waiting list'}`).join('; ')}</p>` : '';
      };
      file.addEventListener('input', check); check();
    },
    validate: (d) => {
      if (!cleanText(d.name)) return { field: 'name', message: 'Enter the patient’s name.' };
      if (!cleanText(d.fileNumber)) return { field: 'fileNumber', message: 'Enter the file number.' };
      if (!(Number(d.weight) > 0)) return { field: 'weight', message: 'Enter the weight in kg.' };
      if ('date' in d && !d.date) return 'Choose a session day, another date, or “Waiting list”.';
      return null;
    },
  });
  if (!r) return;
  const fields = { name: cleanText(r.name), fileNumber: cleanText(r.fileNumber), weight: r.weight, phone: cleanText(r.phone), nextChemoAppt: r.nextChemoAppt, notes: r.notes };
  const date = r.date === 'waiting' ? '' : r.date;
  if (isNew) {
    const row = pc.add({ ...fields, date: date || '' });
    toast(date ? `${row.name} booked for ${fmtDate(date, 'med')}` : `${row.name} added to the waiting list`);
    if (date) { ui.pcDay = date; ui.pcMonth = monthKey(date); ui.pcTab = 'schedule'; } else ui.pcTab = 'waiting';
    focusId = row.id;
    return;
  }
  batch(() => {
    upsert('portcath', { id: p.id, ...fields });
    if ('date' in r) {
      if (!date && p.date) pc.toWaiting(p, 'Moved to waiting list (edit)');
      else if (date && date !== p.date) pc.move(p, date, p.date ? 'Date changed' : 'Assigned from waiting list');
    }
  });
  toast('Saved');
}

async function chooseDate(p, { title, primary, reasonLabel = 'Reason', reasonRequired = false }) {
  const r = await modal({
    title,
    subtitle: `${p.name} · File ${p.fileNumber}${p.date ? ' · now ' + fmtDate(p.date, 'med') : ''}`,
    body: html`${dateChooser({ value: '', exclude: p.date })}
      <label class="field"><span>${reasonLabel}${reasonRequired ? html` <span class="req">*</span>` : ''}</span><input name="reason" autocomplete="off"></label>`,
    primary,
    onMount: mountDateChooser,
    validate: (d) => (!d.date ? 'Choose a day.' : reasonRequired && !d.reason ? { field: 'reason', message: 'Write a short reason.' } : null),
  });
  return r;
}

const QUICK_REASONS = ['Did not come', 'Not fit today (labs / condition)', 'Postponed by the doctor', 'Patient apologised', 'No permit / referral'];

async function notDone(p) {
  const next = upcomingSessions(addDay(todayISO()), 10);
  const r = await modal({
    title: 'Port not done',
    subtitle: `${p.name} · File ${p.fileNumber} · booked ${fmtDate(p.date, 'long')}`,
    size: 'l',
    body: html`
      <div class="field"><span>Why was it not done?</span>
        <div class="pills" data-quick>${QUICK_REASONS.map((q) => html`<button type="button" class="pill" data-q="${q}">${q}</button>`)}</div>
        <input name="reason" placeholder="Reason…" autocomplete="off">
      </div>
      <div class="field"><span>What happens next?</span>
        <div class="choice-list">
          <label class="choice"><input type="radio" name="next" value="move" checked><strong>Carry over to another session (ترحيل)</strong><small>Keeps the patient booked on a new day.</small>
            <div class="sub-field">${dateChooser({ value: next[0] || '', exclude: p.date, from: addDay(todayISO()) })}</div></label>
          <label class="choice"><input type="radio" name="next" value="waiting"><strong>Back to the waiting list</strong><small>No date for now.</small></label>
          <label class="choice"><input type="radio" name="next" value="cancel"><strong>Cancel</strong><small>The patient no longer needs the port here.</small></label>
        </div>
      </div>`,
    primary: 'Save outcome',
    onMount: (dlg) => {
      mountDateChooser(dlg);
      const reason = dlg.querySelector('[name=reason]');
      dlg.querySelector('[data-quick]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-q]');
        if (!b) return;
        reason.value = b.dataset.q;
        $$('[data-q]', dlg).forEach((x) => x.classList.toggle('active', x === b));
      });
    },
    validate: (d) => {
      if (d.next === 'move' && !d.date) return 'Choose the new day, or pick another option.';
      if (d.next === 'cancel' && !d.reason) return { field: 'reason', message: 'Write why the booking is cancelled.' };
      return null;
    },
  });
  if (!r) return;
  const reason = `Not done${r.reason ? ': ' + r.reason : ''}`;
  if (r.next === 'move') { pc.move(p, r.date, reason); toast(`${p.name} carried over to ${fmtDate(r.date, 'med')}`); }
  else if (r.next === 'waiting') { pc.toWaiting(p, reason); toast(`${p.name} is back on the waiting list`); }
  else { pc.cancel(p, reason); toast(`${p.name} cancelled`); }
}
const addDay = (d) => toISO(new Date(parseISO(d).getTime() + 86400000));

async function sessionsDialog() {
  let key = ui.pcMonth;
  const pending = new Map();   // date → active
  const state = (date) => (pending.has(date) ? pending.get(date) : isSessionDay(date));
  const draw = (dlg) => {
    const first = parseISO(key + '-01');
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push('<span class="day out" aria-hidden="true"></span>');
    for (let d = 1; d <= daysIn; d++) {
      const date = `${key}-${String(d).padStart(2, '0')}`;
      const on = state(date);
      const n = patientsOn(date).filter((p) => p.status !== 'cancelled').length;
      cells.push(`<button type="button" class="day ${on ? 'session' : ''} ${date === todayISO() ? 'today' : ''}" data-toggle="${date}" aria-pressed="${on}" aria-label="${esc(fmtDate(date, 'long'))}${on ? ', session day' : ''}${n ? `, ${n} booked` : ''}"><span class="dn">${d}</span>${n ? `<span class="cnt">${n}</span>` : ''}</button>`);
    }
    let count = 0;
    for (let d = 1; d <= daysIn; d++) if (state(`${key}-${String(d).padStart(2, '0')}`)) count++;
    $('[data-cal]', dlg).innerHTML = `
      <div class="cal-head"><button type="button" class="icon-btn" data-m="-1" aria-label="Previous month">${icon('chevL')}</button><h3>${esc(fmtMonth(key))} · ${count} session days</h3><button type="button" class="icon-btn" data-m="1" aria-label="Next month">${icon('chevR')}</button></div>
      <div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<span class="dow">${d}</span>`).join('')}${cells.join('')}</div>`;
  };
  const r = await modal({
    title: 'Session days',
    subtitle: 'Click days to switch them on or off. Changes are saved when you press Save.',
    body: html`<div class="panel" data-cal></div>
      <p class="hint">${icon('alert', 14)} Switching off a day that has bookings does not move the patients. Move them first.</p>`,
    primary: 'Save session days',
    onMount: (dlg) => {
      draw(dlg);
      dlg.addEventListener('click', (e) => {
        const m = e.target.closest('[data-m]');
        if (m) { key = addMonths(key, Number(m.dataset.m)); draw(dlg); return; }
        const t = e.target.closest('[data-toggle]');
        if (!t) return;
        const date = t.dataset.toggle;
        const next = !state(date);
        if (next === isSessionDay(date)) pending.delete(date); else pending.set(date, next);
        draw(dlg);
      });
    },
  });
  if (!r || !pending.size) return;
  batch(() => { for (const [date, on] of pending) setSessionDay(date, on); });
  toast(`Updated ${plural(pending.size, 'day')}`);
}

function historyDialog(p) {
  const items = [...historyOf(p.id), ...samePatient(p.fileNumber, p.id).flatMap((o) => historyOf(o.id))].sort((a, b) => b.timestamp - a.timestamp);
  return modal({
    title: `History — ${p.name}`,
    subtitle: `File ${p.fileNumber} · ${pcStatus(p).label}`,
    body: items.length ? html`<ul class="timeline">${items.map(historyItem)}</ul>` : empty('No history yet', 'Moves, cancellations and outcomes are recorded here.'),
    primary: '',
    secondary: 'Close',
  });
}

// ---------- printing ----------
const COLS = [{ label: 'Patient name', width: '30%' }, { label: 'File #', width: '12%' }, { label: 'Weight', width: '8%', align: 'c' }, { label: 'Phone', width: '14%' }, { label: 'Next chemo', width: '12%' }, { label: 'Notes' }];
const pcRow = (p) => [p.name, p.fileNumber, p.weight ? `${p.weight} kg` : '', p.phone, p.nextChemoAppt ? fmtDate(p.nextChemoAppt, 'full') : '', p.notes];
const daySection = (date) => {
  const pts = patientsOn(date).filter((p) => p.status !== 'cancelled');
  return { heading: `${fmtDate(date, 'long')}`, badge: plural(pts.length, 'patient'), columns: COLS, rows: pts.map(pcRow), empty: 'No patients booked.' };
};

function printDay(date, action) {
  const pts = patientsOn(date).filter((p) => p.status !== 'cancelled');
  return printDialog(() => ({
    title: 'Port Cath Insertion List', when: fmtDate(date, 'full'), whenSub: dayName(date), fileDate: date,
    summary: [{ label: 'patients', value: pts.length }],
    sections: [{ ...daySection(date), heading: '' }],
  }), { title: `Print — ${fmtDate(date, 'long')}`, ...(action ? {} : {}) });
}

async function printMenu() {
  const days = sessionDaysInMonth(ui.pcMonth);
  await printDialog((r) => {
    const scope = r.scope;
    if (scope === 'day') return { title: 'Port Cath Insertion List', when: fmtDate(ui.pcDay, 'full'), whenSub: dayName(ui.pcDay), fileDate: ui.pcDay, sections: [{ ...daySection(ui.pcDay), heading: '' }], summary: [{ label: 'patients', value: patientsOn(ui.pcDay).filter((p) => p.status !== 'cancelled').length }] };
    if (scope === 'month' || scope === 'pick') {
      const chosen = scope === 'pick' ? (r.days || []) : days.filter((d) => patientsOn(d).some((p) => p.status !== 'cancelled'));
      if (!chosen.length) { toast(scope === 'pick' ? 'Choose at least one day.' : 'No patients are booked this month.', { type: 'error' }); return null; }
      return { title: 'Port Cath Schedule', subtitle: fmtMonth(ui.pcMonth), when: fmtMonth(ui.pcMonth), fileDate: ui.pcMonth, sections: chosen.map(daySection), pageBreaks: true };
    }
    if (scope === 'waiting') return waitingDoc();
    if (scope === 'awaiting') return { title: 'Port Cath — Awaiting Outcome', sections: [{ heading: '', columns: [{ label: 'Patient name', width: '30%' }, { label: 'File #' }, { label: 'Booked on' }, { label: 'Phone' }, { label: 'Notes' }], rows: lists().awaiting.map((p) => [p.name, p.fileNumber, fmtDate(p.date, 'full'), p.phone, p.notes]) }] };
    return null;
  }, {
    title: 'Print or export',
    extra: html`
      <div class="choice-list">
        <label class="choice"><input type="radio" name="scope" value="day" checked><strong>Selected day</strong><small>${fmtDate(ui.pcDay, 'long')}</small></label>
        <label class="choice"><input type="radio" name="scope" value="month"><strong>Whole month</strong><small>${fmtMonth(ui.pcMonth)} · every session day with patients, one page each</small></label>
        <label class="choice"><input type="radio" name="scope" value="pick"><strong>Chosen days</strong><small>${days.length ? days.map((d) => html`<label class="check" style="margin-right:10px"><input type="checkbox" name="days" data-multi value="${d}">${fmtDate(d, 'med')}</label>`) : 'No session days this month.'}</small></label>
        <label class="choice"><input type="radio" name="scope" value="waiting"><strong>Waiting list</strong><small>${plural(lists().waiting.length, 'patient')}</small></label>
        <label class="choice"><input type="radio" name="scope" value="awaiting"><strong>Awaiting outcome</strong><small>${plural(lists().awaiting.length, 'patient')}</small></label>
      </div>`,
  });
}

function waitingDoc() {
  return {
    title: 'Port Cath — Waiting List',
    summary: [{ label: 'patients waiting', value: lists().waiting.length }],
    sections: [{ heading: '', columns: [{ label: 'Patient name', width: '28%' }, { label: 'File #' }, { label: 'Weight', align: 'c' }, { label: 'Phone' }, { label: 'Waiting since' }, { label: 'Next chemo' }, { label: 'Notes' }], rows: lists().waiting.map((p) => [p.name, p.fileNumber, p.weight ? `${p.weight} kg` : '', p.phone, fmtDate(String(p.createdAt || '').slice(0, 10), 'full'), p.nextChemoAppt ? fmtDate(p.nextChemoAppt, 'full') : '', p.notes]), empty: 'Nobody is waiting.' }],
  };
}

function csv() {
  const rows = regRows();
  const head = ['Name', 'File number', 'Status', 'Date', 'Weight', 'Phone', 'Next chemo', 'Done on', 'Notes'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((p) => [p.name, p.fileNumber, pcStatus(p).label, p.date, p.weight, p.phone, p.nextChemoAppt, p.doneAt, p.notes].map(q).join(','));
  downloadFile(`port-cath-${todayISO()}.csv`, '﻿' + [head.join(','), ...body].join('\r\n'), 'text/csv');
}

// ---------- handlers ----------
const P = (el) => get('portcath', el.dataset.id);

registerActions({
  'pc-tab': (el) => { ui.pcTab = el.dataset.tab; ui.pcQuery = ''; },
  'pc-month': (el) => { ui.pcMonth = el.dataset.to; },
  'pc-day': (el) => { ui.pcDay = el.dataset.date; },
  'pc-filter': (el) => { ui.pcStatus = el.dataset.f; },
  'pc-add': (el) => editPatient(null, el.dataset.date === 'waiting' ? 'waiting' : el.dataset.date || ''),
  'pc-edit': (el) => editPatient(P(el)),
  'pc-done': (el) => {
    const p = P(el);
    pc.done(p);
    toast(`${p.name}: port done`, { undo: () => pc.undoDone(get('portcath', p.id)) });
  },
  'pc-undo-done': (el) => { pc.undoDone(P(el)); toast('“Port done” removed'); },
  'pc-notdone': (el) => notDone(P(el)),
  'pc-all-done': async (el) => {
    const pts = patientsOn(el.dataset.date).filter(isBooked);
    if (!(await confirmBox(`Mark ${plural(pts.length, 'patient')} on ${fmtDate(el.dataset.date, 'long')} as port done?`, { title: 'All done?', confirm: 'Mark all done' }))) return;
    batch(() => pts.forEach((p) => pc.done(p)));
    toast(`${plural(pts.length, 'patient')} marked port done`);
  },
  'pc-assign': async (el) => {
    const p = P(el);
    const r = await chooseDate(p, { title: 'Assign a date', primary: 'Book', reasonLabel: 'Note (optional)' });
    if (!r) return;
    pc.move(p, r.date, r.reason || 'Assigned from waiting list');
    toast(`${p.name} booked for ${fmtDate(r.date, 'med')}`);
  },
  'pc-move': async (el) => {
    const p = P(el);
    const r = await chooseDate(p, { title: 'Move to another day', primary: 'Move', reasonRequired: true });
    if (!r) return;
    pc.move(p, r.date, r.reason);
    toast(`${p.name} moved to ${fmtDate(r.date, 'med')}`);
  },
  'pc-to-waiting': async (el) => {
    const p = P(el);
    if (!(await confirmBox(`${p.name} will be taken off ${fmtDate(p.date, 'long')} and put back on the waiting list.`, { title: 'Back to waiting list?', confirm: 'Move to waiting list' }))) return;
    pc.toWaiting(p);
    toast(`${p.name} is back on the waiting list`);
  },
  'pc-cancel': async (el) => {
    const p = P(el);
    const r = await modal({ title: 'Cancel booking', subtitle: `${p.name} · File ${p.fileNumber}`, body: html`<label class="field"><span>Reason <span class="req">*</span></span><input name="reason" autocomplete="off"></label>`, primary: 'Cancel booking', secondary: 'Keep', danger: true, validate: (d) => (!d.reason ? { field: 'reason', message: 'Write a short reason.' } : null) });
    if (!r) return;
    pc.cancel(p, r.reason);
    toast(`${p.name} cancelled`, { undo: () => pc.restore(get('portcath', p.id), 'Undo cancel') });
  },
  'pc-restore': (el) => { const p = P(el); pc.restore(p, 'Restored'); toast(`${p.name} restored`); },
  'pc-history': (el) => historyDialog(P(el)),
  'pc-delete': async (el) => {
    const p = P(el);
    if (!(await confirmBox(`Delete ${p.name} (file ${p.fileNumber}) from port cath? Use “Cancel” instead if the booking just won’t happen.`, { title: 'Delete record?', confirm: 'Delete', danger: true }))) return;
    const row = remove('portcath', p.id);
    toast(`${p.name} deleted`, { undo: () => restore('portcath', row) });
  },
  'pc-toggle-session': (el) => {
    const d = el.dataset.date;
    const on = !isSessionDay(d);
    setSessionDay(d, on);
    toast(on ? `${fmtDate(d, 'med')} is now a session day` : `${fmtDate(d, 'med')} is no longer a session day`);
  },
  'pc-sessions': () => sessionsDialog(),
  'pc-print': () => printMenu(),
  'pc-print-day': (el) => printDay(el.dataset.date),
  'pc-word-day': (el) => printDay(el.dataset.date),
  'pc-print-waiting': () => printDialog(() => waitingDoc(), { title: 'Print waiting list' }),
  'pc-csv': () => csv(),
});

registerChanges({
  'pc-query': (el) => { ui.pcQuery = el.value; },
});

export const focusRecord = (id) => { focusId = id; };
