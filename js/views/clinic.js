// Clinic appointments by doctor: month calendar + day list grouped by doctor.
import { html, todayISO, fmtDate, fmtMonth, monthKey, addMonths, parseISO, dayName, relDay, byText, plural, cleanText, isISODate } from '../util.js';
import { registerActions, ui } from '../registry.js';
import { get, create, upsert, remove, restore } from '../store.js';
import { lists, doctorName, doctorColor, clinicDoctors } from '../model.js';
import { icon, modal, confirmBox, toast, menu, empty, datalist } from '../ui.js';
import { printDialog } from '../print.js';
import { settings } from '../settings.js';
import { api } from '../api.js';

export const title = () => 'Clinic Appointments';
export const sub = () => `${fmtDate(ui.clDay || todayISO(), 'long')}`;

let focusId = '';
export function onRoute(params) {
  if (!ui.clDay) ui.clDay = todayISO();
  if (!ui.clMonth) ui.clMonth = monthKey(ui.clDay);
  const id = params.get('focus');
  const c = id && get('clinic', id);
  if (c) { focusId = id; if (c.date) { ui.clDay = c.date; ui.clMonth = monthKey(c.date); } ui.clDoctor = 'all'; }
}
export function mount(root) {
  if (!focusId) return;
  const el = root.querySelector(`[data-row="${CSS.escape(focusId)}"]`);
  focusId = '';
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
}
export const focusRecord = (id) => { focusId = id; };

const visible = (rows) => (ui.clDoctor === 'all' ? rows : rows.filter((r) => doctorName(r.primaryPhysician) === ui.clDoctor));

export function render() {
  const docs = clinicDoctors();
  return html`
    <div class="toolbar">
      <div class="pills" role="group" aria-label="Doctor">
        <button type="button" class="pill ${ui.clDoctor === 'all' ? 'active' : ''}" aria-pressed="${String(ui.clDoctor === 'all')}" data-action="cl-doc" data-d="all">All doctors</button>
        ${docs.map((d) => html`<button type="button" class="pill ${ui.clDoctor === d ? 'active' : ''}" aria-pressed="${String(ui.clDoctor === d)}" data-action="cl-doc" data-d="${d}"><span class="sw" style="background:${doctorColor(d)}"></span>${d}</button>`)}
      </div>
      <span class="spacer"></span>
      <button type="button" class="btn" data-action="cl-colors">${icon('settings', 16)} Doctor colours</button>
      <button type="button" class="btn" data-action="cl-print">${icon('print', 17)} Print</button>
      <button type="button" class="btn btn-primary" data-action="cl-add">${icon('plus', 17)} Add appointment</button>
    </div>
    <div class="split">
      <section class="panel sticky" aria-label="Month calendar">${calendar()}</section>
      <section class="panel" aria-label="Selected day">${dayPanel()}</section>
    </div>`;
}

function calendar() {
  const L = lists();
  const key = ui.clMonth;
  const first = parseISO(key + '-01');
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(html`<span class="day out" aria-hidden="true"></span>`);
  for (let d = 1; d <= daysIn; d++) {
    const date = `${key}-${String(d).padStart(2, '0')}`;
    const rows = visible(L.clinic.filter((c) => c.date === date));
    const byDoc = new Map();
    for (const r of rows) { const k = doctorName(r.primaryPhysician); byDoc.set(k, (byDoc.get(k) || 0) + 1); }
    const cls = [date === L.today && 'today', date < L.today && 'past', date === ui.clDay && 'selected'].filter(Boolean).join(' ');
    cells.push(html`<button type="button" class="day ${cls}" data-action="cl-day" data-date="${date}" aria-pressed="${String(date === ui.clDay)}" aria-label="${fmtDate(date, 'long')}, ${plural(rows.length, 'appointment')}">
      <span class="dn">${d}</span>
      ${rows.length ? html`<span class="cnt" style="background:var(--ink);color:var(--bg)">${rows.length}</span><span class="strip" aria-hidden="true">${[...byDoc].map(([k, n]) => html`<i style="background:${doctorColor(k)};flex:${n}"></i>`)}</span>` : ''}
    </button>`);
  }
  return html`
    <div class="cal-head">
      <button type="button" class="icon-btn" data-action="cl-month" data-to="${addMonths(key, -1)}" aria-label="Previous month">${icon('chevL')}</button>
      <h3>${fmtMonth(key)}</h3>
      <button type="button" class="icon-btn" data-action="cl-month" data-to="${addMonths(key, 1)}" aria-label="Next month">${icon('chevR')}</button>
    </div>
    <div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => html`<span class="dow">${d}</span>`)}${cells}</div>
    ${ui.clDay !== todayISO() ? html`<div class="cal-legend"><button type="button" class="btn btn-sm" data-action="cl-day" data-date="${todayISO()}">Go to today</button></div>` : ''}`;
}

function groups(rows) {
  const m = new Map();
  for (const r of rows) { const k = doctorName(r.primaryPhysician); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m].sort((a, b) => byText(a[0], b[0])).map(([k, list]) => [k, list.sort((a, b) => byText(a.name, b.name))]);
}

function dayPanel() {
  const L = lists();
  const date = ui.clDay;
  const rows = visible(L.clinic.filter((c) => c.date === date));
  return html`
    <div class="panel-head">
      <div><h2>${fmtDate(date, 'long')} <span class="muted small">${relDay(date)}</span></h2><p>${plural(rows.length, 'appointment')}${ui.clDoctor !== 'all' ? ` · ${ui.clDoctor}` : ''}</p></div>
      <div class="row">
        <button type="button" class="btn btn-sm" data-action="cl-print-day">${icon('print', 15)} Print day</button>
        <button type="button" class="btn btn-sm btn-primary" data-action="cl-add" data-date="${date}">${icon('plus', 15)} Add</button>
      </div>
    </div>
    ${rows.length ? groups(rows).map(([doc, list]) => html`
      <div class="doc-group" style="--doc:${doctorColor(doc)}">
        <div class="doc-h"><span>${doc}</span><span class="n">${plural(list.length, 'patient')}</span></div>
        <ul class="pt-list">${list.map((c) => html`
          <li class="pt" data-row="${c.id}" style="grid-template-columns:minmax(0,1fr) auto">
            <div style="min-width:0">
              <div class="nm"><button type="button" data-action="cl-edit" data-id="${c.id}">${c.name || 'Unnamed'}</button></div>
              <div class="facts"><span>File <b class="ltr">${c.fileNumber || '—'}</b></span>${c.age ? html`<span><b>${c.age}</b> yrs</span>` : ''}${c.case ? html`<span>${c.case}</span>` : ''}${c.causeOfAdmission ? html`<span>${c.causeOfAdmission}</span>` : ''}</div>
              ${c.note ? html`<div class="note rtl-text">${c.note}</div>` : ''}
            </div>
            <div class="acts">${menu(html`
              <button type="button" data-action="cl-edit" data-id="${c.id}">${icon('edit', 16)} Edit</button>
              <hr><button type="button" class="danger" data-action="cl-delete" data-id="${c.id}">${icon('trash', 16)} Delete</button>`)}</div>
          </li>`)}</ul>
      </div>`)
    : empty('No appointments on this day', 'Pick another day on the calendar or add an appointment.')}`;
}

async function edit(c) {
  const isNew = !c;
  c ||= { date: ui.clDay, primaryPhysician: ui.clDoctor !== 'all' ? ui.clDoctor : settings.get('lastPhysician') || '' };
  const r = await modal({
    title: isNew ? 'Add clinic appointment' : 'Edit appointment',
    body: html`
      <div class="grid-2">
        <label class="field span-2"><span>Patient name <span class="req">*</span></span><input name="name" value="${c.name || ''}" autocomplete="off"></label>
        <label class="field"><span>File number <span class="req">*</span></span><input name="fileNumber" class="ltr" value="${c.fileNumber || ''}" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span>Age</span><input name="age" type="number" min="0" max="120" value="${c.age || ''}" inputmode="numeric"></label>
        <label class="field"><span>Date <span class="req">*</span></span><input name="date" type="date" value="${c.date || ''}"></label>
        <label class="field"><span>Doctor <span class="req">*</span></span><input name="primaryPhysician" list="cl-docs" value="${c.primaryPhysician || ''}" autocomplete="off"></label>
        <label class="field"><span>Case</span><input name="case" value="${c.case || ''}" autocomplete="off"></label>
        <label class="field"><span>Reason for visit</span><input name="causeOfAdmission" value="${c.causeOfAdmission || ''}" autocomplete="off"></label>
        <label class="field span-2"><span>Note</span><textarea name="note" rows="2">${c.note || ''}</textarea></label>
      </div>${datalist('cl-docs', clinicDoctors().filter((d) => d !== 'Unassigned'))}`,
    primary: isNew ? 'Add appointment' : 'Save changes',
    validate: (d) => {
      if (!cleanText(d.name)) return { field: 'name', message: 'Enter the patient’s name.' };
      if (!cleanText(d.fileNumber)) return { field: 'fileNumber', message: 'Enter the file number.' };
      if (!isISODate(d.date)) return { field: 'date', message: 'Choose the date.' };
      if (!cleanText(d.primaryPhysician)) return { field: 'primaryPhysician', message: 'Enter the doctor.' };
      return null;
    },
  });
  if (!r) return;
  const fields = { name: cleanText(r.name), fileNumber: cleanText(r.fileNumber), age: r.age, date: r.date, primaryPhysician: cleanText(r.primaryPhysician), case: r.case, causeOfAdmission: r.causeOfAdmission, note: r.note };
  settings.set({ lastPhysician: fields.primaryPhysician });
  if (isNew) { const row = create('clinic', fields); focusId = row.id; toast(`${row.name} booked with ${row.primaryPhysician}`); }
  else { upsert('clinic', { id: c.id, ...fields }); toast('Saved'); }
  ui.clDay = r.date; ui.clMonth = monthKey(r.date);
}

async function colors() {
  const docs = clinicDoctors();
  if (!docs.length) { toast('No doctors yet. Add an appointment first.', { type: 'error' }); return; }
  const r = await modal({
    title: 'Doctor colours',
    subtitle: 'Used on the calendar and the day list. Shared with the team.',
    size: 's',
    body: html`<div class="stack">${docs.map((d, i) => html`<label class="row-between"><span class="row"><span class="pill" style="pointer-events:none"><span class="sw" style="background:${doctorColor(d)}"></span>${d}</span></span><input type="color" name="c${i}" value="${doctorColor(d)}" aria-label="Colour for ${d}" style="width:52px;height:34px;border:0;background:none"></label>`)}</div>`,
    primary: 'Save colours',
  });
  if (!r) return;
  const map = { ...settings.get('physicianColors') };
  docs.forEach((d, i) => { map[d] = r[`c${i}`]; });
  settings.set({ physicianColors: map });
  api.writeSetting('clinicPhysicianColors', JSON.stringify(map)).catch(() => toast('Colours saved on this device; the sheet will get them next time.', { type: 'error' }));
  toast('Colours saved');
}

const COLS = [{ label: 'Patient name', width: '26%' }, { label: 'File #', width: '11%' }, { label: 'Age', width: '6%', align: 'c' }, { label: 'Case', width: '17%' }, { label: 'Reason', width: '17%' }, { label: 'Note' }];
const row = (c) => [c.name, c.fileNumber, c.age, c.case, c.causeOfAdmission, c.note];

function printDay() {
  const date = ui.clDay;
  const rows = visible(lists().clinic.filter((c) => c.date === date));
  return printDialog(() => ({
    title: 'Clinic Appointments List', when: fmtDate(date, 'full'), whenSub: dayName(date), fileDate: date,
    summary: [{ label: 'appointments', value: rows.length }],
    sections: groups(rows).map(([doc, list]) => ({ heading: doc, badge: plural(list.length, 'patient'), columns: COLS, rows: list.map(row) })),
    signature: false,
  }), { title: `Print ${fmtDate(date, 'long')}` });
}

function printMenu() {
  const docs = clinicDoctors();
  return printDialog((r) => {
    const doc = r.doctor;
    const from = r.from || todayISO();
    const rows = lists().clinic.filter((c) => c.date >= from && (doc === 'all' || doctorName(c.primaryPhysician) === doc)).sort((a, b) => a.date.localeCompare(b.date) || byText(a.name, b.name));
    const byDate = new Map();
    for (const c of rows) { if (!byDate.has(c.date)) byDate.set(c.date, []); byDate.get(c.date).push(c); }
    return {
      title: 'Clinic Appointments List', subtitle: doc === 'all' ? 'All doctors' : doc, when: `From ${fmtDate(from, 'full')}`, fileDate: from,
      summary: [{ label: 'appointments', value: rows.length }],
      sections: [...byDate].map(([d, list]) => ({ heading: fmtDate(d, 'long'), badge: plural(list.length, 'patient'), columns: doc === 'all' ? [{ label: 'Doctor', width: '14%' }, ...COLS] : COLS, rows: list.map((c) => (doc === 'all' ? [doctorName(c.primaryPhysician), ...row(c)] : row(c))) })),
      signature: false,
    };
  }, {
    title: 'Print upcoming appointments',
    extra: html`<div class="grid-2">
      <label class="field"><span>Doctor</span><select name="doctor"><option value="all">All doctors</option>${docs.map((d) => html`<option value="${d}" ${ui.clDoctor === d ? 'selected' : ''}>${d}</option>`)}</select></label>
      <label class="field"><span>From</span><input type="date" name="from" value="${todayISO()}"></label></div>`,
  });
}

registerActions({
  'cl-doc': (el) => { ui.clDoctor = el.dataset.d; },
  'cl-month': (el) => { ui.clMonth = el.dataset.to; },
  'cl-day': (el) => { ui.clDay = el.dataset.date; ui.clMonth = monthKey(ui.clDay); },
  'cl-add': () => edit(null),
  'cl-edit': (el) => edit(get('clinic', el.dataset.id)),
  'cl-delete': async (el) => {
    const c = get('clinic', el.dataset.id);
    if (!(await confirmBox(`Delete the appointment of ${c.name} on ${fmtDate(c.date, 'long')}?`, { title: 'Delete appointment?', confirm: 'Delete', danger: true }))) return;
    const r = remove('clinic', c.id);
    toast(`${c.name} deleted`, { undo: () => restore('clinic', r) });
  },
  'cl-colors': () => colors(),
  'cl-print': () => printMenu(),
  'cl-print-day': () => printDay(),
});
