// Daily planned admissions: one day at a time, most urgent first.
import { html, todayISO, fmtDate, addDays, dayName, relDay, matches, byText, plural, cleanText, uniq, isISODate } from '../util.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { get, create, upsert, remove, restore } from '../store.js';
import { lists, TRIAGE, DEPARTMENTS, REFERRALS, TRANSPORT, PERFORMANCE, knownPhysicians } from '../model.js';
import { icon, modal, confirmBox, toast, menu, chip, empty, dateNav, datalist } from '../ui.js';
import { printDialog } from '../print.js';

export const title = () => 'Planned Admissions';
export const sub = () => fmtDate(ui.admDate || todayISO(), 'long');

let focusId = '';
export function onRoute(params) {
  if (!ui.admDate) ui.admDate = todayISO();
  const id = params.get('focus');
  const a = id && get('admissions', id);
  if (a) { focusId = id; if (a.date) ui.admDate = a.date; ui.admDept = 'all'; ui.admQuery = ''; }
}
export function mount(root) {
  if (!focusId) return;
  const el = root.querySelector(`[data-row="${CSS.escape(focusId)}"]`);
  focusId = '';
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
}
export const focusRecord = (id) => { focusId = id; };

const tone = (s) => ({ 1: 'red', 2: 'orange', 3: 'amber', 4: 'green', 5: 'blue' }[s] || '');

export function render() {
  const L = lists();
  const date = ui.admDate;
  const day = L.admissions.filter((a) => a.date === date);
  const rows = day
    .filter((a) => ui.admDept === 'all' || a.admissionDepartment === ui.admDept)
    .filter((a) => matches(ui.admQuery, a.name, a.fileNumber, a.primaryPhysician, a.summary, a.causeOfAdmission, a.notes))
    .sort((a, b) => Number(a.triageScore || 9) - Number(b.triageScore || 9) || byText(a.name, b.name));
  const depts = uniq([...DEPARTMENTS, ...day.map((a) => a.admissionDepartment).filter(Boolean)]);
  const week = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i));

  return html`
    <div class="toolbar">
      ${dateNav(date, 'adm-date')}
      <div class="date-chips" aria-label="Next 7 days">
        ${week.map((d) => { const n = L.admissions.filter((a) => a.date === d).length; return html`<button type="button" class="date-chip ${d === date ? 'on' : ''}" data-action="adm-date" data-to="${d}" aria-pressed="${String(d === date)}"><b>${d === todayISO() ? 'Today' : fmtDate(d, 'med')}</b><small>${plural(n, 'patient')}</small></button>`; })}
      </div>
    </div>
    <div class="toolbar">
      <div class="pills" role="group" aria-label="Department">
        <button type="button" class="pill ${ui.admDept === 'all' ? 'active' : ''}" aria-pressed="${String(ui.admDept === 'all')}" data-action="adm-dept" data-d="all">All <span>${day.length}</span></button>
        ${depts.map((d) => html`<button type="button" class="pill ${ui.admDept === d ? 'active' : ''}" aria-pressed="${String(ui.admDept === d)}" data-action="adm-dept" data-d="${d}">${d} <span>${day.filter((a) => a.admissionDepartment === d).length}</span></button>`)}
      </div>
      <span class="spacer"></span>
      <label class="search-box"><span class="sr-only">Search admissions</span>${icon('search', 16)}<input class="input" type="search" value="${ui.admQuery}" data-input="adm-query" data-key="adm-q" placeholder="Name, file, doctor…" autocomplete="off"></label>
      <button type="button" class="btn" data-action="adm-expand" aria-pressed="${String(ui.admExpanded)}">${icon('expand', 16)} ${ui.admExpanded ? 'Less detail' : 'More detail'}</button>
      <button type="button" class="btn" data-action="adm-print">${icon('print', 17)} Print</button>
      <button type="button" class="btn btn-primary" data-action="adm-add">${icon('plus', 17)} Add admission</button>
    </div>
    ${rows.length ? html`<div class="cards">${rows.map(card)}</div>`
      : html`<section class="panel">${empty(day.length ? 'No match' : `No admissions on ${fmtDate(date, 'long')}`, day.length ? 'Change the department or the search.' : 'Add one, or import the day’s Excel sheet.', day.length ? '' : html`<div class="row"><button type="button" class="btn btn-sm btn-primary" data-action="adm-add">${icon('plus', 15)} Add admission</button><a class="btn btn-sm" href="#/import">${icon('upload', 15)} Smart import</a></div>`)}</section>`}`;
}

function card(a) {
  const t = TRIAGE[a.triageScore];
  return html`
    <article class="acard" data-triage="${a.triageScore}" data-row="${a.id}">
      <div class="acard-top">
        <div style="min-width:0">
          <h3><button type="button" class="name-btn" data-action="adm-edit" data-id="${a.id}">${a.name || 'Unnamed'}</button></h3>
          <div class="sub">File <span class="ltr">${a.fileNumber || '—'}</span>${a.age ? ` · ${a.age} yrs` : ''} · ${a.primaryPhysician || 'No doctor'}</div>
        </div>
        ${menu(html`
          <button type="button" data-action="adm-edit" data-id="${a.id}">${icon('edit', 16)} Edit</button>
          <button type="button" data-action="adm-move" data-id="${a.id}">${icon('forward', 16)} Move to another date</button>
          <hr><button type="button" class="danger" data-action="adm-delete" data-id="${a.id}">${icon('trash', 16)} Delete</button>`)}
      </div>
      <div class="row">${chip(t ? `${a.triageScore} · ${t.label}` : 'No triage', tone(a.triageScore))}${a.admissionDepartment ? chip(a.admissionDepartment, 'brand') : ''}</div>
      <dl>
        ${a.summary ? html`<div class="wide"><dt>Summary</dt><dd class="rtl-text">${a.summary}</dd></div>` : ''}
        ${a.causeOfAdmission ? html`<div class="wide"><dt>Cause of admission</dt><dd class="rtl-text">${a.causeOfAdmission}</dd></div>` : ''}
        ${ui.admExpanded ? html`
          <div><dt>Referral</dt><dd>${a.placeOfReferral || '—'}</dd></div>
          <div><dt>Transport</dt><dd>${a.modeOfTransportation || '—'}</dd></div>
          <div><dt>Performance</dt><dd>${a.performanceStatus || '—'}</dd></div>
          <div><dt>Date</dt><dd>${fmtDate(a.date, 'med')}</dd></div>` : ''}
        ${a.notes ? html`<div class="wide"><dt>Notes</dt><dd class="rtl-text">${a.notes}</dd></div>` : ''}
      </dl>
    </article>`;
}

const sel = (name, options, value) => html`<select name="${name}">${options.map((o) => html`<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`)}${value && !options.includes(value) ? html`<option selected>${value}</option>` : ''}</select>`;

async function edit(a) {
  const isNew = !a;
  a ||= { date: ui.admDate, triageScore: '3', placeOfReferral: 'Home', modeOfTransportation: 'Private Car', performanceStatus: 'Walking', admissionDepartment: 'Treatment room' };
  const r = await modal({
    title: isNew ? 'Add planned admission' : 'Edit admission',
    size: 'l',
    body: html`
      <div class="grid-3">
        <label class="field span-2"><span>Patient name <span class="req">*</span></span><input name="name" value="${a.name || ''}" autocomplete="off"></label>
        <label class="field"><span>File number <span class="req">*</span></span><input name="fileNumber" class="ltr" value="${a.fileNumber || ''}" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span>Age</span><input name="age" type="number" min="0" max="120" value="${a.age || ''}" inputmode="numeric"></label>
        <label class="field"><span>Triage <span class="req">*</span></span><select name="triageScore">${Object.entries(TRIAGE).map(([k, t]) => html`<option value="${k}" ${String(a.triageScore) === k ? 'selected' : ''}>${k} — ${t.label}</option>`)}</select></label>
        <label class="field"><span>Date of admission <span class="req">*</span></span><input name="date" type="date" value="${a.date || ''}"></label>
        <label class="field"><span>Primary physician <span class="req">*</span></span><input name="primaryPhysician" list="adm-docs" value="${a.primaryPhysician || ''}" autocomplete="off"></label>
        <label class="field"><span>Department <span class="req">*</span></span>${sel('admissionDepartment', DEPARTMENTS, a.admissionDepartment)}</label>
        <label class="field"><span>Place of referral</span>${sel('placeOfReferral', REFERRALS, a.placeOfReferral)}</label>
        <label class="field"><span>Transportation</span>${sel('modeOfTransportation', TRANSPORT, a.modeOfTransportation)}</label>
        <label class="field"><span>Performance status</span>${sel('performanceStatus', PERFORMANCE, a.performanceStatus)}</label>
        <span></span>
        <label class="field span-3"><span>Brief summary of the case</span><textarea name="summary" rows="2">${a.summary || ''}</textarea></label>
        <label class="field span-3"><span>Cause of admission</span><input name="causeOfAdmission" value="${a.causeOfAdmission || ''}" autocomplete="off"></label>
        <label class="field span-3"><span>Notes</span><textarea name="notes" rows="2">${a.notes || ''}</textarea></label>
      </div>
      ${datalist('adm-docs', knownPhysicians())}`,
    primary: isNew ? 'Add admission' : 'Save changes',
    validate: (d) => {
      if (!cleanText(d.name)) return { field: 'name', message: 'Enter the patient’s name.' };
      if (!cleanText(d.fileNumber)) return { field: 'fileNumber', message: 'Enter the file number.' };
      if (!isISODate(d.date)) return { field: 'date', message: 'Choose the admission date.' };
      if (!cleanText(d.primaryPhysician)) return { field: 'primaryPhysician', message: 'Enter the primary physician.' };
      const dup = lists().admissions.find((x) => x.id !== a.id && x.date === d.date && cleanText(x.fileNumber) === cleanText(d.fileNumber));
      if (dup && d._submitter !== 'force') return `${dup.name} is already planned for ${fmtDate(d.date, 'med')}.`;
      return null;
    },
  });
  if (!r) return;
  const fields = {
    name: cleanText(r.name), fileNumber: cleanText(r.fileNumber), age: r.age, triageScore: r.triageScore, primaryPhysician: cleanText(r.primaryPhysician),
    admissionDepartment: r.admissionDepartment, placeOfReferral: r.placeOfReferral, modeOfTransportation: r.modeOfTransportation, performanceStatus: r.performanceStatus,
    date: r.date, summary: r.summary, causeOfAdmission: r.causeOfAdmission, notes: r.notes,
  };
  if (isNew) { const row = create('admissions', fields); focusId = row.id; toast(`${row.name} added for ${fmtDate(row.date, 'med')}`); }
  else { upsert('admissions', { id: a.id, ...fields }); toast('Saved'); }
  ui.admDate = r.date;
}

function printAdm() {
  const L = lists();
  const dates = uniq(L.admissions.map((a) => a.date).filter((d) => d && d >= addDays(todayISO(), -14))).sort();
  return printDialog((r) => {
    const chosen = r.scope === 'pick' ? (r.days || []) : [ui.admDate];
    if (!chosen.length) { toast('Choose at least one date.', { type: 'error' }); return null; }
    const cols = [{ label: 'Patient name', width: '13%' }, { label: 'File no.', width: '7%' }, { label: 'Age', width: '4%', align: 'c' }, { label: 'Triage', width: '9%' }, { label: 'Physician', width: '9%' }, { label: 'Brief case summary', width: '13%' }, { label: 'Cause of admission', width: '12%' }, { label: 'Referral', width: '6%' }, { label: 'Transport', width: '7%' }, { label: 'Performance', width: '7%' }, { label: 'Department', width: '7%' }, { label: 'Note' }];
    const sections = chosen.map((d) => {
      const rows = L.admissions.filter((a) => a.date === d).sort((a, b) => Number(a.triageScore || 9) - Number(b.triageScore || 9) || byText(a.name, b.name));
      return { heading: chosen.length > 1 ? `${fmtDate(d, 'long')}` : '', badge: plural(rows.length, 'patient'), columns: cols, rows: rows.map((a) => [a.name, a.fileNumber, a.age, a.triageScore ? `${a.triageScore} (${TRIAGE[a.triageScore]?.label || ''})` : '', a.primaryPhysician, a.summary, a.causeOfAdmission, a.placeOfReferral, a.modeOfTransportation, a.performanceStatus, a.admissionDepartment, a.notes]) };
    });
    return { title: 'Daily Planned Admissions', when: chosen.length === 1 ? fmtDate(chosen[0], 'full') : `${chosen.length} days`, whenSub: chosen.length === 1 ? dayName(chosen[0]) : '', fileDate: chosen[0], landscape: true, sections, pageBreaks: true, signature: false };
  }, {
    title: 'Print admissions',
    extra: html`<div class="choice-list">
      <label class="choice"><input type="radio" name="scope" value="day" checked><strong>${fmtDate(ui.admDate, 'long')}</strong><small>${plural(L.admissions.filter((a) => a.date === ui.admDate).length, 'patient')}</small></label>
      <label class="choice"><input type="radio" name="scope" value="pick"><strong>Several dates</strong><small>${dates.length ? dates.map((d) => html`<label class="check" style="margin-right:10px"><input type="checkbox" name="days" data-multi value="${d}">${fmtDate(d, 'med')}</label>`) : 'No recent dates.'}</small></label>
    </div>`,
  });
}

registerActions({
  'adm-date': (el) => { ui.admDate = el.dataset.to; },
  'adm-dept': (el) => { ui.admDept = el.dataset.d; },
  'adm-expand': () => { ui.admExpanded = !ui.admExpanded; },
  'adm-add': () => edit(null),
  'adm-edit': (el) => edit(get('admissions', el.dataset.id)),
  'adm-move': async (el) => {
    const a = get('admissions', el.dataset.id);
    const r = await modal({ title: 'Move admission', subtitle: `${a.name} · now ${fmtDate(a.date, 'long')}`, size: 's', body: html`<label class="field"><span>New date</span><input type="date" name="date" value="${addDays(a.date || todayISO(), 1)}"></label>`, primary: 'Move', validate: (d) => (!isISODate(d.date) ? 'Choose a date.' : null) });
    if (!r) return;
    upsert('admissions', { id: a.id, date: r.date });
    toast(`${a.name} moved to ${fmtDate(r.date, 'med')} (${relDay(r.date)})`);
  },
  'adm-delete': async (el) => {
    const a = get('admissions', el.dataset.id);
    if (!(await confirmBox(`Delete the admission of ${a.name} on ${fmtDate(a.date, 'long')}?`, { title: 'Delete admission?', confirm: 'Delete', danger: true }))) return;
    const row = remove('admissions', a.id);
    toast(`${a.name} deleted`, { undo: () => restore('admissions', row) });
  },
  'adm-print': () => printAdm(),
});
registerChanges({
  'adm-date': (el) => { if (el.value) ui.admDate = el.value; },
  'adm-query': (el) => { ui.admQuery = el.value; },
});
