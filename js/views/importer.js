// Smart import: Excel sheets → port cath, admissions, follow-up or clinic.
// Columns are matched automatically and can be corrected before importing.
import { html, $, todayISO, fmtDate, toISO, cleanText, normFile, readFileAs, loadXLSX, plural } from '../util.js';
import { registerActions, registerChanges, rerender, navigate, ui } from '../registry.js';
import { create, batch } from '../store.js';
import { lists, pc, DEPARTMENTS } from '../model.js';
import { icon, toast, chip, empty } from '../ui.js';

export const title = () => 'Smart Import';
export const sub = () => 'Excel → lists';

const TARGETS = {
  portcath: {
    label: 'Port cath', fields: [
      { id: 'name', label: 'Patient name', req: true, kw: ['patient name', 'name', 'fullname'] },
      { id: 'fileNumber', label: 'File number', req: true, kw: ['patient code', 'code', 'file number', 'fileno', 'file', 'mrn', 'id'] },
      { id: 'date', label: 'Procedure date', kw: ['date', 'appointment date', 'appt date', 'procedure date'] },
      { id: 'weight', label: 'Weight', kw: ['weight', 'kg'] },
      { id: 'phone', label: 'Phone', kw: ['phone', 'mobile', 'tel'] },
      { id: 'notes', label: 'Notes', kw: ['notes', 'comment', 'remarks'] },
    ],
  },
  admissions: {
    label: 'Planned admissions', fields: [
      { id: 'name', label: 'Patient name', req: true, kw: ['patient name', 'name', 'fullname'] },
      { id: 'fileNumber', label: 'File number', req: true, kw: ['patient code', 'code', 'file number', 'fileno', 'file', 'mrn', 'id'] },
      { id: 'age', label: 'Age', kw: ['age', 'years'] },
      { id: 'triageScore', label: 'Triage', kw: ['triage', 'priority'] },
      { id: 'primaryPhysician', label: 'Physician', kw: ['physician', 'doctor', 'dr'] },
      { id: 'admissionDepartment', label: 'Department', kw: ['department', 'dept', 'ward'] },
      { id: 'date', label: 'Date of admission', kw: ['date', 'appointment date', 'appt date', 'admission date'] },
      { id: 'summary', label: 'Case summary', kw: ['summary', 'case', 'diagnosis'] },
      { id: 'causeOfAdmission', label: 'Cause of admission', kw: ['cause', 'service', 'reason'] },
      { id: 'notes', label: 'Notes', kw: ['notes', 'comment', 'remarks'] },
    ],
  },
  followup: {
    label: 'WhatsApp & call follow-up', fields: [
      { id: 'name', label: 'Patient name', req: true, kw: ['patient name', 'name', 'fullname'] },
      { id: 'phone', label: 'Phone', req: true, kw: ['phone', 'mobile', 'tel', 'telephone'] },
      { id: 'fileNumber', label: 'File number / ID', req: true, kw: ['patient code', 'code', 'file number', 'fileno', 'file', 'identity', 'id'] },
      { id: 'date', label: 'Follow-up date', kw: ['date', 'appointment date', 'follow-up date'] },
      { id: 'task', label: 'Requested task', req: true, kw: ['task', 'service', 'reason', 'procedure', 'notes', 'comment'] },
    ],
  },
  clinic: {
    label: 'Clinic appointments', fields: [
      { id: 'name', label: 'Patient name', req: true, kw: ['patient name', 'name', 'fullname'] },
      { id: 'fileNumber', label: 'File number', req: true, kw: ['patient code', 'code', 'file number', 'fileno', 'file', 'mrn', 'id'] },
      { id: 'age', label: 'Age', kw: ['age', 'years'] },
      { id: 'date', label: 'Date', kw: ['date', 'appointment date', 'appt date'] },
      { id: 'primaryPhysician', label: 'Doctor', kw: ['physician', 'doctor', 'dr', 'service'] },
      { id: 'case', label: 'Case', kw: ['case', 'diagnosis'] },
      { id: 'note', label: 'Note', kw: ['notes', 'note', 'comment', 'remarks'] },
    ],
  },
};

const S = { files: [], target: 'admissions', map: {}, skip: new Set(), dept: 'Treatment room', busy: false };

export function onRoute(params) { if (params.get('to') && TARGETS[params.get('to')]) S.target = params.get('to'); }

// ---------- parsing helpers ----------
function dateFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '');
  const m3 = base.match(/(\d{1,4})[-./_](\d{1,2})[-./_](\d{2,4})/);
  if (m3) {
    let [a, b, c] = [Number(m3[1]), Number(m3[2]), Number(m3[3])];
    const d = a > 1000 ? new Date(a, b - 1, c) : new Date(c < 100 ? 2000 + c : c, b - 1, a);
    if (!isNaN(d)) return toISO(d);
  }
  const m2 = base.match(/(\d{1,2})[-./_](\d{1,2})/);
  if (m2) { const d = new Date(new Date().getFullYear(), Number(m2[2]) - 1, Number(m2[1])); if (!isNaN(d)) return toISO(d); }
  return '';
}

function headerRow(rows) {
  const kw = ['name', 'code', 'file', 'id', 'no', 'date', 'service', 'notes', 'phone', 'summary', 'cause', 'age'];
  let best = 0; let max = 0;
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const n = (rows[r] || []).reduce((s, c) => s + kw.filter((k) => String(c ?? '').toLowerCase().includes(k)).length, 0);
    if (n > max) { max = n; best = r; }
  }
  return best;
}

function cellDate(v) {
  if (v === '' || v == null) return '';
  if (v instanceof Date) return toISO(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel serial day → local calendar date (no time-zone shift).
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim().split(' ')[0];
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return '';
}

function physicianFrom(text) {
  const s = String(text || '');
  const i = s.toLowerCase().indexOf('dr.');
  return i > -1 ? s.slice(i).split('-')[0].trim() : '';
}
const num = (v) => { const m = String(v ?? '').match(/\d+(\.\d+)?/); return m ? m[0] : ''; };

function autoMap() {
  const headers = S.files[0]?.headers || [];
  const map = {};
  const used = new Set();
  for (const f of TARGETS[S.target].fields) {
    let idx = -1;
    for (const k of f.kw) {
      idx = headers.findIndex((h, i) => !used.has(i) && h.toLowerCase().includes(k));
      if (idx > -1) break;
    }
    if (idx > -1) used.add(idx);
    map[f.id] = idx;
  }
  S.map = map;
}

// Builds the records that will be created, with a reason when a row is skipped.
function buildRows() {
  const L = lists();
  const out = [];
  const t = S.target;
  const seen = new Set();
  S.files.forEach((file, fi) => {
    file.rows.forEach((row, ri) => {
      const v = (id) => { const i = S.map[id]; return i > -1 && i < row.length ? row[i] : ''; };
      const rec = {};
      for (const f of TARGETS[t].fields) rec[f.id] = f.id === 'date' ? cellDate(v('date')) || file.date : cleanText(v(f.id));
      if (t === 'portcath') rec.weight = num(v('weight'));
      if (t === 'admissions' || t === 'clinic') rec.age = num(v('age'));
      if (t === 'admissions') {
        if (!['1', '2', '3', '4', '5'].includes(rec.triageScore)) rec.triageScore = '3';
        rec.primaryPhysician ||= physicianFrom(v('causeOfAdmission')) || 'Unassigned';
        rec.admissionDepartment ||= S.dept;
        Object.assign(rec, { placeOfReferral: 'Home', modeOfTransportation: 'Private Car', performanceStatus: 'Walking' });
      }
      if (t === 'clinic') rec.primaryPhysician = physicianFrom(rec.primaryPhysician) || rec.primaryPhysician || 'Unassigned';
      const missing = TARGETS[t].fields.filter((f) => f.req && !rec[f.id]).map((f) => f.label);
      let problem = missing.length ? `Missing ${missing.join(', ')}` : '';
      if (!problem && t !== 'portcath' && !rec.date) problem = 'No date';
      const key = `${normFile(rec.fileNumber)}|${rec.date}|${t === 'followup' ? rec.task.toLowerCase() : ''}`;
      if (!problem) {
        const list = t === 'portcath' ? L.portcath : L[t];
        const dup = list.some((x) => normFile(x.fileNumber) === normFile(rec.fileNumber) && (t === 'portcath' ? x.status !== 'cancelled' && x.status !== 'done' : x.date === rec.date) && (t !== 'followup' || String(x.task).toLowerCase() === rec.task.toLowerCase()));
        if (dup) problem = t === 'portcath' ? 'Already on the port list' : 'Already on this date';
        else if (seen.has(key)) problem = 'Repeated in the file';
      }
      seen.add(key);
      out.push({ key: `${fi}:${ri}`, rec, file: file.name, problem });
    });
  });
  return out;
}

// ---------- render ----------
export function render() {
  if (!S.files.length) {
    return html`
      <div class="steps"><span class="on"><i>1</i>Choose files</span>${icon('chevR', 14)}<span><i>2</i>Check columns</span>${icon('chevR', 14)}<span><i>3</i>Import</span></div>
      <label class="drop" data-drop>
        ${icon('upload', 30)}
        <strong>Drop Excel files here, or click to choose</strong>
        <span class="small muted">Several days at once is fine. A date in the file name (e.g. 25-5.xlsx) becomes that sheet’s default date.</span>
        <input type="file" accept=".xlsx,.xls,.csv" multiple class="sr-only" data-change="imp-files">
      </label>
      ${S.busy ? html`<p class="hint" style="margin-top:12px">${icon('clock', 14)} Reading files…</p>` : ''}`;
  }
  const t = TARGETS[S.target];
  const headers = S.files[0].headers;
  const rows = buildRows();
  const ok = rows.filter((r) => !r.problem && !S.skip.has(r.key));
  const first = ['name', 'fileNumber', 'date'];
  const fieldsShown = [...first.map((id) => t.fields.find((f) => f.id === id)).filter(Boolean), ...t.fields.filter((f) => !first.includes(f.id))].slice(0, 6);
  return html`
    <div class="steps"><span><i>1</i>Choose files</span>${icon('chevR', 14)}<span class="on"><i>2</i>Check columns</span>${icon('chevR', 14)}<span class="on"><i>3</i>Import</span></div>
    <div class="stack" style="gap:18px">
      <section class="panel">
        <div class="panel-head"><div><h2>Where should these rows go?</h2><p>${plural(rows.length, 'row')} from ${plural(S.files.length, 'file')}</p></div>
          <button type="button" class="btn btn-sm" data-action="imp-reset">${icon('x', 15)} Start over</button></div>
        <div class="panel-body stack">
          <div class="pills" role="group" aria-label="Import into">${Object.entries(TARGETS).map(([k, v]) => html`<button type="button" class="pill ${S.target === k ? 'active' : ''}" aria-pressed="${String(S.target === k)}" data-action="imp-target" data-t="${k}">${v.label}</button>`)}</div>
          <div class="grid-2">
            ${S.files.map((f, i) => html`<label class="field"><span>${f.name} · ${plural(f.rows.length, 'row')}</span><input type="date" value="${f.date}" data-change="imp-file-date" data-i="${i}" aria-label="Default date for ${f.name}"></label>`)}
            ${S.target === 'admissions' ? html`<label class="field"><span>Department when the sheet has none</span><select data-change="imp-dept">${DEPARTMENTS.map((d) => html`<option ${d === S.dept ? 'selected' : ''}>${d}</option>`)}</select></label>` : ''}
          </div>
          ${S.target === 'portcath' ? html`<p class="hint">${icon('alert', 14)} Rows with a date are booked on that day; rows without one go to the waiting list.</p>` : ''}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>Columns</h2><p>Matched from the header row. Fix any that are wrong.</p></div></div>
        <div class="panel-body map-grid">
          ${t.fields.map((f) => html`<label class="field"><span>${f.label}${f.req ? html` <span class="req">*</span>` : ''}</span>
            <select data-change="imp-map" data-f="${f.id}"><option value="-1">— not in the file —</option>${headers.map((h, i) => html`<option value="${i}" ${S.map[f.id] === i ? 'selected' : ''}>${h || `Column ${i + 1}`}</option>`)}</select></label>`)}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div><h2>Preview</h2><p>${ok.length} will be imported · ${rows.filter((r) => r.problem).length} skipped</p></div>
          <button type="button" class="btn btn-primary" data-action="imp-go" ${ok.length && !S.busy ? '' : 'disabled'}>${icon('check', 16)} Import ${plural(ok.length, 'row')}</button>
        </div>
        ${rows.length ? html`<div class="preview" style="border:0;border-radius:0"><table class="data">
          <thead><tr><th><span class="sr-only">Include</span></th>${fieldsShown.map((f) => html`<th>${f.label}</th>`)}<th>Status</th></tr></thead>
          <tbody>${rows.map((r) => html`<tr>
            <td><input type="checkbox" ${!r.problem && !S.skip.has(r.key) ? 'checked' : ''} ${r.problem ? 'disabled' : ''} data-change="imp-skip" data-k="${r.key}" aria-label="Include row"></td>
            ${fieldsShown.map((f) => html`<td class="${f.id === 'notes' || f.id === 'task' ? 'rtl-text' : ''}">${f.id === 'date' ? (r.rec.date ? fmtDate(r.rec.date, 'med') : S.target === 'portcath' ? chip('Waiting list', 'amber') : '—') : r.rec[f.id] || ''}</td>`)}
            <td>${r.problem ? chip(r.problem, 'orange') : chip('Ready', 'green')}</td></tr>`)}</tbody>
        </table></div>` : empty('No rows')}
      </section>
    </div>`;
}

export function mount(root) {
  const drop = $('[data-drop]', root);
  if (!drop) return;
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); readFiles(e.dataTransfer.files); });
}

async function readFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  S.busy = true; rerender();
  try {
    const XLSX = await loadXLSX();
    const out = [];
    for (const file of files) {
      try {
        const wb = XLSX.read(await readFileAs(file), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        const h = headerRow(rows);
        const data = rows.slice(h + 1).filter((r) => r.some((c) => c !== '' && c != null));
        if (data.length) out.push({ name: file.name, headers: (rows[h] || []).map((x) => String(x).trim()), rows: data, date: dateFromFilename(file.name) || todayISO() });
      } catch (e) { toast(`Could not read ${file.name}: ${e.message}`, { type: 'error' }); }
    }
    if (!out.length) { toast('No data rows were found in those files.', { type: 'error' }); return; }
    S.files = out; S.skip = new Set(); autoMap();
  } catch (e) { toast(e.message, { type: 'error' }); }
  finally { S.busy = false; rerender(); }
}

function go() {
  const rows = buildRows().filter((r) => !r.problem && !S.skip.has(r.key));
  if (!rows.length) return;
  const t = S.target;
  batch(() => {
    for (const { rec } of rows) {
      if (t === 'portcath') pc.add({ name: rec.name, fileNumber: rec.fileNumber, weight: rec.weight, phone: rec.phone, notes: rec.notes, date: rec.date || '', nextChemoAppt: '' });
      else if (t === 'followup') create('followup', { ...rec, taskResult: '' });
      else create(t, rec);
    }
  });
  toast(`Imported ${plural(rows.length, 'row')} into ${TARGETS[t].label}`);
  const first = rows[0].rec.date;
  S.files = []; S.skip = new Set();
  if (first) {
    if (t === 'admissions') ui.admDate = first;
    if (t === 'followup') ui.fuDate = first;
    if (t === 'clinic') { ui.clDay = first; ui.clMonth = first.slice(0, 7); }
    if (t === 'portcath') { ui.pcDay = first; ui.pcMonth = first.slice(0, 7); ui.pcTab = 'schedule'; }
  } else if (t === 'portcath') ui.pcTab = 'waiting';
  navigate(t);
}

registerActions({
  'imp-target': (el) => { S.target = el.dataset.t; S.skip = new Set(); autoMap(); rerender(); },
  'imp-reset': () => { S.files = []; S.skip = new Set(); rerender(); },
  'imp-go': () => go(),
});
registerChanges({
  'imp-files': (el) => readFiles(el.files),
  'imp-file-date': (el) => { S.files[Number(el.dataset.i)].date = el.value; rerender(); },
  'imp-dept': (el) => { S.dept = el.value; rerender(); },
  'imp-map': (el) => { S.map[el.dataset.f] = Number(el.value); rerender(); },
  'imp-skip': (el) => { if (el.checked) S.skip.delete(el.dataset.k); else S.skip.add(el.dataset.k); rerender(); },
});
